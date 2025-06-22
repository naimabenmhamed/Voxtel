import React, { useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, PermissionsAndroid, Alert, Keyboard, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Add from './Add';
import Resumer from './resumer';
import axios from 'axios';
import RNFS from 'react-native-fs';

export default function AfficherNotes({ route, navigation }) {
  const { note, fromHome } = route.params;
  const currentUser = auth().currentUser;

  if (!note) {
    return (
      <View style={styles.container}>
        <Text style={{ color: 'red' }}>Aucune donnée à afficher</Text>
      </View>
    );
  }

  const isOwner = currentUser && (note.userId === currentUser.uid || note.sharedBy === currentUser.uid);

  const handleDeleteText = async (id) => {
    try {
      await firestore().collection('notes').doc(id).delete();
      Alert.alert("Supprimé", "La note a été supprimée.");
      navigation.goBack();
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
    }
  };

  const handlePublish = async () => {
    try {
      await firestore().collection('notes').doc(note.id).update({
        visibility: 'public',
      });
      Alert.alert('Publication réussie', 'La recette a été publiée avec succès.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de la publication.');
      console.error(error);
    }
  };

  const handleSummary = async () => {
    try {
      const params = new URLSearchParams();
      params.append('texte', note.leçon);

      const response = await axios.post(
        'http://192.168.8.110:8000/resumer/',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const résumé = response.data.résumé;
      navigation.navigate('Resumer', { résumé });
      Alert.alert("Résumé généré", résumé);

    } catch (error) {
      console.error("Erreur avec l'API :", error);
      Alert.alert("Erreur", "Impossible de générer le résumé.");
    }
  };

  async function requestWritePermission() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Permission de stockage',
          message: 'L’application doit accéder au stockage pour sauvegarder le PDF',
          buttonNeutral: 'Plus tard',
          buttonNegative: 'Annuler',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  function cleanFilename(title) {
    return title
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
  }

  async function generatePDF(note) {
    const hasPermission = await requestWritePermission(); // ✅ Correction ici
    if (!hasPermission) {
      Alert.alert('Permission refusée');
      return;
    }

    try {
      console.log("📝 Génération PDF pour :", note.title);

      const formData = new FormData();
      formData.append('text', note.leçon); // ✅ Correction ici

      const response = await axios.post('http://192.168.8.110:8000/generate-pdf/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      });

      const reader = new FileReader();
      reader.onload = async () => {
        const base64data = reader.result.split(',')[1];
        const filename = `${cleanFilename(note.title)}_${Date.now()}.pdf`;
        const path = `${RNFS.DownloadDirectoryPath}/${filename}`;
       

        await RNFS.writeFile(path, base64data, 'base64');
        Alert.alert('Succès', `PDF enregistré sous : ${filename}`);
      };
      reader.readAsDataURL(response.data);

    } catch (e) {
      console.error('Erreur PDF :', e);
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {note.userName && (
        <Text style={[styles.label, { fontSize: 20, textAlign: 'center', marginBottom: 10 }]}>
          {note.userName}
        </Text>
      )}

      <Text style={styles.label}>Titre</Text>
      <Text style={styles.text}>{note.title}</Text>

      <Text style={styles.label}>Leçon</Text>
      <Text style={styles.text}>{note.leçon || 'Aucun Leçon'}</Text>

      {isOwner && note.visibility !== 'public' && (
        <TouchableOpacity style={styles.button} onPress={handlePublish}>
          <Text style={styles.buttonText}>Publier la leçon</Text>
        </TouchableOpacity>
      )}

      {note.image && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${note.image}` }}
          style={{ width: '100%', height: 200, marginTop: 20, borderRadius: 10 }}
          resizeMode="cover"
        />
      )}

      {isOwner && !fromHome && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Add', {
            id: note.id,
            title: note.title,
            leçon: note.leçon
          })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Modifier</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.noteDate}>
        {note.createdAt?.toDate?.().toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }) ?? ''}
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => generatePDF(note)}>
        <Text style={styles.buttonText}>PDF</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSummary} style={styles.button}>
        <Text style={styles.buttonText}>Resumer</Text>
      </TouchableOpacity>

      {isOwner && (
        <TouchableOpacity
          onPress={() => handleDeleteText(note.id)}
          style={styles.deleteButton}
        >
          <Icon name="trash-outline" size={19} color="#999" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF',
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  },
  text: {
    fontSize: 16,
    color: '#555',
    marginTop: 10,
    lineHeight: 24,
    backgroundColor: '#f6f6f6',
    padding: 10,
    borderRadius: 8,
  },
  noteDate: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 10,
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: [{ translateX: -50 }],
  },
  deleteButton: {
    backgroundColor: '#E0FFFF',
    padding: 5,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 5,
    width: '20%',
  },
  button: {
    marginTop: 30,
    backgroundColor: '#1E90FF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
