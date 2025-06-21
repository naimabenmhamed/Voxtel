// Home.js - Composant pour afficher les notes publiques aléatoires
import { StyleSheet, View, Text, TextInput, Alert, TouchableOpacity, FlatList, ActivityIndicator,Image } from "react-native";
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import React, { useEffect, useState } from "react";
import Icon from 'react-native-vector-icons/Ionicons';
import Chatboot from './chatboot';

export default function Home({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [refreshing, setRefreshing] = useState(false);

  const openNote = (note) => {
    navigation.navigate('AfficherNotes', { note, fromHome: true });
  };

  const handleRefresh = async () => {
  setRefreshing(true);

  try {
    const snapshot = await firestore()
      .collection('notes')
      .where('visibility', '==', 'public')
      .get();

    let fetchedNotes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const enrichedNotes = await Promise.all(
      fetchedNotes.map(async (note) => {
        if (note.userId) {
          try {
            const userDoc = await firestore().collection('users').doc(note.userId).get();
            const userData = userDoc.data();
            return {
              ...note,
              photoProfil: userData?.photoProfil || null,
              userName: userData?.nom || "Utilisateur inconnu",
            };
          } catch (err) {
            console.error('Erreur récupération profil:', err);
          }
        }
        return note;
      })
    );

    setNotes(enrichedNotes.sort(() => 0.5 - Math.random()));
  } catch (error) {
    console.error("Erreur lors du rafraîchissement :", error);
    Alert.alert("Erreur", "Impossible de rafraîchir les notes.");
  }

  setRefreshing(false);
};

  const handleLogout = async () => {
    try {
      await auth().signOut();
      navigation.navigate('CreatAccont');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

useEffect(() => {
  const unsubscribe = firestore()
    .collection('notes')
    .where('visibility', '==', 'public')
    .onSnapshot(async (snapshot) => {
      let fetchedNotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Enrichir chaque note avec le profil utilisateur
      const enrichedNotes = await Promise.all(
        fetchedNotes.map(async (note) => {
          if (note.userId) {
            try {
              const userDoc = await firestore().collection('users').doc(note.userId).get();
              const userData = userDoc.data();
              return {
                ...note,
                photoProfil: userData?.photoProfil || null,
                userName: userData?.nom || "Utilisateur inconnu",
              };
            } catch (err) {
              console.error('Erreur récupération profil:', err);
            }
          }
          return note;
        })
      );

      setNotes(enrichedNotes.sort(() => 0.5 - Math.random()));
      setLoading(false);
    }, error => {
      console.error('Erreur lors de l\'écoute des notes :', error);
      Alert.alert('Erreur', 'Impossible de charger les notes publiques');
      setLoading(false);
    });

  return () => unsubscribe();
}, []);
// Fonction de recherche améliorée
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults(notes);
    } else {
      const results = notes.filter(note => 
        note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.leçon?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.userName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
    }
  }, [searchQuery, notes]);
  const renderItem = ({ item }) => {
    const currentUser = auth().currentUser;
    const hasLiked = item.likes?.includes(currentUser?.uid);

    const toggleLike = async () => {
      if (!currentUser) {
        Alert.alert('Erreur', 'Vous devez être connecté pour aimer une note');
        return;
      }

      const noteRef = firestore().collection('notes').doc(item.id);

      try {
        // Méthode alternative sans transaction pour éviter les problèmes de permissions
        const currentLikes = item.likes || [];
        let newLikes;

        if (hasLiked) {
          // Retirer le like
          newLikes = currentLikes.filter(uid => uid !== currentUser.uid);
        } else {
          // Ajouter le like
          newLikes = [...currentLikes, currentUser.uid];
        }

        // Mise à jour directe du document
        await noteRef.update({
          likes: newLikes
        });

        // Mise à jour locale immédiate pour une meilleure UX
        setNotes(prev =>
          prev.map(n =>
            n.id === item.id
              ? { ...n, likes: newLikes }
              : n
          )
        );

        console.log('Like mis à jour avec succès');

      } catch (error) {
        console.error("Erreur lors du like :", error);
        
        // Messages d'erreur spécifiques
        if (error.code === 'firestore/permission-denied') {
          Alert.alert(
            'Permission refusée', 
            'Vous n\'avez pas les permissions nécessaires pour aimer cette note. Vérifiez les règles Firestore.'
          );
        } else if (error.code === 'firestore/not-found') {
          Alert.alert('Erreur', 'Cette note n\'existe plus');
        } else if (error.code === 'firestore/offline') {
          Alert.alert('Erreur', 'Vous êtes hors ligne. Vérifiez votre connexion internet.');
        } else {
          Alert.alert('Erreur', `Impossible d'aimer cette note: ${error.message}`);
        }
      }
    };

    return (
      <TouchableOpacity onPress={() => openNote(item)} style={styles.noteItem}>
        <View style={styles.userInfo}>
  {item.photoProfil ? (
  <Image
    source={{ uri: item.photoProfil.startsWith('data:image') || item.photoProfil.startsWith('http') 
      ? item.photoProfil 
      : `data:image/jpeg;base64,${item.photoProfil}` }}
    style={styles.avatar}
  />
) : (
  <Icon name="person-circle-outline" size={30} color="#3B82F6" />
)}

  <Text style={styles.userName}>{item.userName || "Utilisateur inconnu"}</Text>
</View>

        <Text style={styles.noteTitle}>{item.title}</Text>
        {item.ingredient && (
          <Text style={styles.noteIngredient}>{item.leçon}</Text>
        )}

        {/* Bouton Like avec meilleure gestion */}
        <TouchableOpacity 
          onPress={toggleLike} 
          style={styles.likeContainer}
          disabled={!auth().currentUser} // Désactiver si pas connecté
        >
          <Icon 
            name={hasLiked ? "heart" : "heart-outline"} 
            size={18} 
            color={hasLiked ? "red" : "#6B7280"} 
          />
          <Text style={styles.likeCount}>{item.likes?.length || 0}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const filteredNotes = notes.filter(note =>
    note.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
     <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          placeholder="Rechercher note public disponible"
          placeholderTextColor="#999"
          style={styles.input}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" />
      ) : notes.length > 0 ? (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
           refreshing={refreshing}
  onRefresh={handleRefresh}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune note publique disponible</Text>
        </View>
      )}
 <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chatboot')}>
        <Icon name="chatbox-outline" size={30} color="#777" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
         <Icon name="log-out-outline" size={24} color="#fff" />
      </TouchableOpacity>
     
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  chatButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1E90FF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#555',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    color: '#000',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0FFFF',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginVertical: 8,
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  logoutButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    backgroundColor: '#1E90FF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#555',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,

  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noteItem: {
    backgroundColor: '#F0F8FF',
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userName: {
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 5,
    fontSize: 14,
    
  },
  noteTitle: {
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontSize: 16,
  },
  noteContent: {
    color: '#333',
    lineHeight: 20,
    marginBottom: 5,
  },
  noteIngredient: {
    color: '#6B7280',
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 5,
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 5,
  },
  likeCount: {
    marginLeft: 5,
    color: '#6B7280',
    fontSize: 14,
  },
  userInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 5,
},
avatar: {
  width: 30,
  height: 30,
  borderRadius: 15,
  marginRight: 10,
},

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
  },
});