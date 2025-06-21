import { useState, useEffect } from 'react';
import { Alert, Keyboard,PermissionsAndroid, Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker';

export const saveNotes= (route, navigation) => {
    const [title, setTitle] = useState('');
    const [leçon, setLeçon] = useState('');
    const [loading, setLoading] = useState(false);
    const [idToUpdate, setIdToUpdate] = useState(null);
    const [initialTitle, setInitialTitle] = useState('');
    const [initialLeçon, setInitialLeçon] = useState('');
    // const [ingredient, setIngredient] = useState('');
    const [initialIngredient, setInitialIngredient] = useState('');
    const [visibility, setVisibility] = useState('private'); // par défaut privée
    const [imageBase64, setImageBase64] = useState(null);

  useEffect(() => {
   // Nettoyer quand le composant est démonté
   return () => {
     setIdToUpdate(null);
     setTitle('');
     setLeçon('');
    //  setIngredient('');
     setImageBase64(null);

   };
 }, []);
   // Effet pour gérer les paramètres de navigation
   useEffect(() => {
     if (route.params?.id) {
       // Mode édition - charger les données existantes
       setIdToUpdate(route.params.id);
       setTitle(route.params.title || '');
       setLeçon(route.params.leçon || '');
      //  setIngredient(route.params.ingredient || '');
     } else {
       // Mode création - réinitialiser
       setIdToUpdate(null);
       setTitle('');
       setLeçon('');
        setInitialTitle('');
     setInitialLeçon('');
    //  setIngredient('');
     setImageBase64(null);

     }
   }, [route.params]);
 
   const handleAddOrUpdate = async () => {
     const currentUser = auth().currentUser;
 
     if (!currentUser) {
       Alert.alert('Erreur', 'Utilisateur non connecté.');
       return;
     }
 
     if (!title.trim()) {
       Alert.alert('Erreur', 'Le titre est obligatoire');
       return;
     }
     if (idToUpdate && title.trim() === initialTitle.trim() && leçon.trim() === initialLeçon.trim() ) {
     Alert.alert('تنبيه', 'لم يتم أي تعديل'); // Pas de modifications
     navigation.goBack(); // Retourner sans modifier
     return;
   }
     try {
       setLoading(true);
       const userDoc = await firestore()
         .collection('users')
         .doc(currentUser.uid)
         .get();
 
       if (!userDoc.exists) {
         Alert.alert('Erreur', 'Profil utilisateur non trouvé.');
         return;
       }
 
       const userData = userDoc.data();
       const userName = userData.nom;
 
       if (idToUpdate) {
         // Mise à jour de la note existante
         await firestore()
           .collection('notes')
           .doc(idToUpdate)
           .update({
             title,
             leçon,
            //  ingredient,
              visibility,
               visibility: visibility,
              image: imageBase64,
             updatedAt: firestore.FieldValue.serverTimestamp(),
             userName,
              likes: [], // <- Champ ajouté ici
           });
       } else {
         // Création d'une nouvelle note
         await firestore()
           .collection('notes')
           .add({
             title,
             leçon,
            //  ingredient ,
             userId: currentUser.uid,
             userName,
             visibility: visibility || 'private',
              image: imageBase64,
             createdAt: firestore.FieldValue.serverTimestamp(),
             updatedAt: firestore.FieldValue.serverTimestamp(),
           });
       }
 
       // Réinitialiser et naviguer vers ToNotes
          // Réinitialisation complète
     setIdToUpdate(null);
     setTitle('');
     setLeçon('');
    //  setIngredient('');
     Keyboard.dismiss();
     setImageBase64(null);

     
     // Naviguer vers ToNotes et nettoyer l'historique
     navigation.reset({
       index: 0,
       routes: [{ name: 'ToNotes' }],
     });
     } catch (error) {
       Alert.alert('Erreur', error.message);
     } finally {
       setLoading(false);
     }
   };
 const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Permission requise',
        message: 'Cette application a besoin d\'accéder à votre galerie',
        buttonNeutral: 'Plus tard',
        buttonNegative: 'Annuler',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

const selectImage = async () => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    Alert.alert('Permission refusée', 'Impossible d\'accéder aux images.');
    return;
  }

  const result = await launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
  });

  if (result.assets && result.assets.length > 0) {
    const image = result.assets[0];
    setImageBase64(image.base64);
  }
};


  return {
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
    visibility,            // <= ajoute ceci
    setVisibility ,
    imageBase64,
    setImageBase64,
    selectImage

  };
  
};