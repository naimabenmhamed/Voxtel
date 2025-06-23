import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, StyleSheet, Text, TouchableOpacity, Button,Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Notes from './Notes';
import NotesPr from './NotesPr';
import styles from '../Styles/Explore.styles';
import Toast from 'react-native-toast-message';
import ModifierNomComponent from './ModifierN';
import ChatList from '../Chat/ChatListe';
import {launchImageLibrary} from 'react-native-image-picker';
import useNomUtilisateur from '../hooks/Nomutillisateur'
import Recorde from './Recorde'
export default function Explore({ navigation }) {
  const [activeTab, setActiveTab] = useState(0);
  // const [nom, setNom] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

const { nom, setNom, userId } = useNomUtilisateur(); // ✅ AVEC setNom
 
const choisirImageProfil = async () => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
  });

  if (result.didCancel) return;
  if (result.errorCode) {
    console.log('Erreur image:', result.errorMessage);
    return;
  }

  if (result.assets && result.assets.length > 0) {
    const image = result.assets[0];
    setProfileImage(image.uri); // Pour affichage local

    // Sauvegarde dans Firestore
    const currentUser = auth().currentUser;
    if (currentUser) {
      await firestore().collection('users').doc(currentUser.uid).update({
        photoProfil: image.base64, // stocke la base64 dans Firestore
      });
      Toast.show({
        type: 'success',
        text1: 'Image mise à jour',
      });
    }
  }
};

useEffect(() => {
  const fetchProfile = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      const doc = await firestore().collection('users').doc(currentUser.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.photoProfil) {
          setProfileImage(`data:image/jpeg;base64,${data.photoProfil}`);
        }
      }
    }
  };

  fetchProfile();
}, []);

useEffect(() => {
  async function ajouterNomParDefaut() {
    const usersSnapshot = await firestore().collection('users').get();
    usersSnapshot.forEach(async (doc) => {
      const data = doc.data();
      if (!data.nom) {
        await firestore().collection('users').doc(doc.id).update({
          nom: 'Hi!',
        });
      }
    });
  }
  
  ajouterNomParDefaut();
}, []);



  const ouvrirModifNom = () => {
    setShowDialog(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Section supérieure avec photo et nom */}
      <View style={styles.profileHeader}>
        <View style={styles.profileIconContainer}>
          <TouchableOpacity onPress={choisirImageProfil}>
  {profileImage ? (
    <Image
      source={{ uri: profileImage }}
      style={{ width: 60, height: 60, borderRadius: 30 }}
    />
  ) : (
    <Icon name="person" size={50} color="#555" />
  )}
</TouchableOpacity>

        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.userName}>{nom}</Text>
          <TouchableOpacity onPress={ouvrirModifNom} style={styles.buttonStyle}>
            {/* <Icon name="id-card-outline" size={30} color="#999" /> */}
            <Text>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 0 && styles.activeTab]}
          onPress={() => setActiveTab(0)}
        >
          <Icon name="lock-closed" size={24} color={activeTab === 1 ? "#7f8c8d" : "#1E90FF"} />
    <Text style={styles.tabLabel}>Privés</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 1 && styles.activeTab]}
          onPress={() => setActiveTab(1)}
        >
         <Icon name="earth" size={24} color={activeTab === 0 ? "#7f8c8d" : "#1E90FF"} />
    <Text style={styles.tabLabel}>Publics</Text>
        </TouchableOpacity>
      </View>

      {/* Contenu principal */}
      <View style={styles.content}>
        {activeTab === 0 && <Notes />}
        {activeTab === 1 && <NotesPr />}
      </View>

      {/* Bouton de chat */}
      <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('ChatListe')}>
        <Icon name="chatbox" size={30} color="#777" />
      </TouchableOpacity>
       {/* <Button title='hi' onPress={()=> navigation.navigate('Recorde')} /> */}
      {/* // Le composant de dialogue */}
{showDialog && (
  <ModifierNomComponent 
    userId={userId} 
    visible={showDialog} 
    onClose={() => setShowDialog(false)} 
    onNameUpdated={(newName) => { 
    setNom(newName); // Mise à jour locale
  }}
  />
)}
      <Toast />
    </SafeAreaView>
  );
};
