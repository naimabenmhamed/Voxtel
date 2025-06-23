import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, PermissionsAndroid, Alert, Keyboard, Image} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { uploadAudio } from './Tranc';
import { CommonActions } from '@react-navigation/native';
import { saveNotes } from '../services/saveNotes';
import {Audio } from '../hooks/Audio';
import styles from '../Styles/Add.styles';
const audioRecorderPlayer = new AudioRecorderPlayer();

export default function Add({ navigation, route }) {
  


  const {
    idToUpdate,
    title,
    setTitle,
    leçon,
    setLeçon,
    setIdToUpdate,
    initialTitle,
    setInitialTitle,
    initialLeçon,
    setInitialLeçon,
    handleAddOrUpdate,
    loading,
    // ingredient,
    // setIngredient,
    imageBase64,
    setImageBase64,
    selectImage,  visibility,            // <= ajoute ceci
  setVisibility 

  } = saveNotes(route, navigation);
  // États pour l'audio
 

 const {
    titleRecording, 
  setTitleRecording,
  titleRecordedFilePath, 
  setTitleRecordedFilePath,
  titlePlaying, 
  setTitlePlaying, 
  titleTranscribedText, 
  setTitleTranscribedText,
  recording, 
  setRecording,
  recordedFilePath, 
  setRecordedFilePath,
  playing, 
  setPlaying,
  transcribedText, 
  setTranscribedText,
  recordinge, 
  setRecordinge,
  recordedFilePathe, 
  setRecordedFilePathe,
  playinge, 
  setPlayinge,
  transcribedTexte, 
  setTranscribedTexte,
  onStopPlay,
  onStartPlay,
  onStopRecord,
  onStartRecord,
  requestPermission,
  onStartRecordDescription,
  onStopRecordDescription,
  onStartPlayDescription,
  onStopPlayDescription,
  onStartRecordIngredient,
  onStopRecordIngredient,
  onStartPlayIngredient,
  onStopPlayIngredient,
  recordinges, 
  setRecordinges,
  recordedFilePathes, 
  setRecordedFilePathes,
  playinges, 
  setPlayinges,
  transcribedTextes, 
  setTranscribedTextes,
 
  } = Audio(route, navigation);
useEffect(() => {
  if (transcribedText) {
    setTitle(transcribedText);
  }
}, [transcribedText]);

useEffect(() => {
  if (transcribedTextes) {
    setLeçon(transcribedTextes);
  }
}, [transcribedTextes]);

const handleCancelEdit = () => {
  setIdToUpdate(null);
  setTitle('');
  setLeçon('');
  setInitialTitle('');
  setInitialLeçon('');
  navigation.goBack(); // ou navigation.navigate('ToNotes') si vous voulez rediriger
};
const convertAndSave = async () => {
  try {
    // 1. Convertir les valeurs transcrites en valeurs principales si elles existent
    const finalTitle = transcribedText || title;
    const finalLecon = transcribedTextes || leçon;

    // 2. Mettre à jour les états principaux
    setTitle(finalTitle);
    setLeçon(finalLecon);

    // 3. Attendre un court instant pour que les états se mettent à jour
    await new Promise(resolve => setTimeout(resolve, 100));

    // 4. Appeler la fonction de sauvegarde originale
    await handleAddOrUpdate();
// 5. Effacer les états après sauvegarde
    setTitle('');
    setLeçon('');
    setTranscribedText('');
    setTranscribedTextes('');
    setImageBase64(null);
    setRecordedFilePath('');
    setRecordedFilePathes('');

  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    Alert.alert("Erreur", "Impossible de sauvegarder la leçon");
  }
};
  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Nouvelle lesson</Text>
        <View style={styles.from}>
          {/* Section Titre */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <Text style={styles.label}>Titre</Text>
            {recordedFilePath !== '' && !playing &&  (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}}  
                onPress={onStartPlay}>
                <Icon name="volume-mute-outline" size={43} color="#555"/>
              </TouchableOpacity>
            )}
            {playing &&(
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}} 
                onPress={onStopPlay}>
                <Icon name="volume-high-outline" size={43} color="#555"/>
              </TouchableOpacity>
            )}
            {!recording ? (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}}  
                onPress={onStartRecord}>
                <Icon name="mic-outline" size={43} color="#444" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}}  
                onPress={() => onStopRecord(true)}>
                <Icon name="ellipsis-horizontal-outline" size={43} color="#444" />
              </TouchableOpacity>
            )}
          </View>
        
          <TextInput
  style={styles.input}
  value={transcribedText || title}
  onChangeText={(text) => {
    setTitle(text);
    setTranscribedText(text);
  }}
  placeholder="Entrer le Titre"
  placeholderTextColor="#999" 
/>
          {/* Section ingredient */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <Text style={styles.label}>Leçon</Text>
            {recordedFilePathes !== '' && !playinges &&  (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}}  
                onPress={onStartPlayIngredient}>
                <Icon name="volume-mute-outline" size={43} color="#555"/>
              </TouchableOpacity>
            )}
            {playinges && (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}} 
                onPress={onStopPlayIngredient}>
                <Icon name="volume-high-outline" size={43} color="#555"/>
              </TouchableOpacity>
            )}
            {!recordinges ?  (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}}  
                onPress={onStartRecordIngredient}>
                <Icon name="mic-outline" size={43} color="#444" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={{backgroundColor:"#1E90FF", borderRadius: 20, padding: 4, width: 50, height: 50}}  
                onPress={onStopRecordIngredient}>
                <Icon name="ellipsis-horizontal-outline" size={43} color="#444" />
              </TouchableOpacity>
            )}
          </View>
          
          <TextInput
  style={[styles.input, styles.textArea]}
  value={transcribedTextes || leçon}
  onChangeText={(text) => {
    setLeçon(text);
    setTranscribedTextes(text);
  }}
  placeholder="Entrer le Leçon"
  placeholderTextColor="#999" 
  multiline
  numberOfLines={5}
/>

             {/* Section Description */}
         

            <TouchableOpacity onPress={selectImage} style={[styles.button, { marginTop: 10 }]}>
                <Text style={styles.buttonText}> Choisir la photo </Text>
            </TouchableOpacity>

          {imageBase64 && (
          <Image
            source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
            style={{ width: '100%', height: 200, marginTop: 10, borderRadius: 10 }}
            resizeMode="cover"
          />
          )}



          
         
<Text style={styles.label}>Confidentialité</Text>
<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
  <TouchableOpacity
    style={[
      styles.visibilityButton,
      visibility === 'private' && styles.visibilityButtonSelected,
    ]}
    onPress={() => setVisibility('private')}
  >
    <Text
      style={[
        styles.visibilityText,
        visibility === 'private' && styles.visibilityTextSelected,
      ]}
    >
      Privée
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.visibilityButton,
      visibility === 'public' && styles.visibilityButtonSelected,
    ]}
    onPress={() => setVisibility('public')}
  >
    <Text
      style={[
        styles.visibilityText,
        visibility === 'public' && styles.visibilityTextSelected,
      ]}
    >
      Publique
    </Text>
  </TouchableOpacity>
</View>
<TouchableOpacity 
            style={styles.button} 
           onPress={convertAndSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Enregistrement en cours...' : (idToUpdate ? 'Modifier' : 'Ajouter')}
            </Text>
          </TouchableOpacity>

{ (idToUpdate || title.trim() !== '' || leçon.trim() !== '') && (
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={handleCancelEdit}
  >
         <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
)}


        </View>
      </ScrollView>
    </View>
  );
}

