import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  Image,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const CreateGroup = ({ navigation }) => {
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = Firestore()
      .collection('friends')
      .where('users', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        const friendsData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const data = doc.data();
            const friendId = data.users.find(uid => uid !== currentUser.uid);
            const userDoc = await Firestore().collection('users').doc(friendId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              // Vérification améliorée de l'avatar comme dans ChatList
              let avatarUrl = null;
              if (userData?.photoURL) {
                avatarUrl = userData.photoURL;
              } else if (userData?.photoProfil) {
                if (userData.photoProfil.startsWith('data:image')) {
                  avatarUrl = userData.photoProfil;
                } else if (userData.photoProfil.startsWith('/9j/')) {
                  avatarUrl = `data:image/jpeg;base64,${userData.photoProfil}`;
                } else {
                  avatarUrl = userData.photoProfil;
                }
              } else if (userData?.avatar) {
                avatarUrl = userData.avatar;
              }

              return {
                id: friendId,
                name: userData.nom || userData.displayName || 'Ami',
                avatar: avatarUrl,
                isOnline: userData.isOnline || false
              };
            }
            return null;
          })
        );
        setFriends(friendsData.filter(f => f !== null));
      });

    return () => unsubscribe();
  }, [currentUser]);

  const toggleFriendSelection = (friendId) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId) 
        : [...prev, friendId]
    );
  };

const createGroup = async () => {
  if (!groupName.trim()) {
    Alert.alert("Erreur", "Veuillez donner un nom au groupe");
    return;
  }

  if (selectedFriends.length === 0) {
    Alert.alert("Erreur", "Veuillez sélectionner au moins un ami");
    return;
  }

  try {
    // 1. Créer le groupe d'abord
    const groupData = {
      name: groupName.trim(),
      members: [currentUser.uid, ...selectedFriends],
      createdBy: currentUser.uid,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      lastMessage: "",
      lastMessageSender: ""
    };

    const groupRef = await Firestore()
      .collection('groups')
      .add(groupData);

    console.log('Groupe créé avec ID:', groupRef.id);

    // 2. Mettre à jour seulement le profil de l'utilisateur actuel
    // Les autres utilisateurs mettront à jour leur profil quand ils rejoindront le groupe
    const currentUserRef = Firestore().collection('users').doc(currentUser.uid);
    await currentUserRef.update({
      groups: Firestore.FieldValue.arrayUnion(groupRef.id)
    });
    console.log('Profil utilisateur mis à jour');

    // 3. Navigation vers le chat de groupe
    // Utiliser setTimeout pour s'assurer que tout est bien committé
    setTimeout(() => {
      navigation.navigate('GroupChat', {
        groupId: groupRef.id,
        groupName: groupName.trim(),
        members: [currentUser.uid, ...selectedFriends]
      });
    }, 100);

  } catch (error) {
    console.error("Erreur détaillée lors de la création du groupe:", error);
    
    // Afficher une erreur plus spécifique selon le type d'erreur
    let errorMessage = "Impossible de créer le groupe";
    
    if (error.code === 'permission-denied') {
      errorMessage = "Permissions insuffisantes pour créer le groupe";
    } else if (error.code === 'network-error') {
      errorMessage = "Erreur de connexion. Vérifiez votre réseau";
    } else if (error.message) {
      errorMessage = `Erreur: ${error.message}`;
    }
    
    Alert.alert("Erreur", errorMessage);
  }
};

  const renderFriend = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.friendItem,
        selectedFriends.includes(item.id) && styles.selectedFriend
      ]}
      onPress={() => toggleFriendSelection(item.id)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image 
            source={{ uri: item.avatar }} 
            style={styles.avatar}
            onError={(e) => console.log("Erreur de chargement de l'avatar:", e.nativeEvent.error)}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
      </View>
      
      <Text style={styles.friendName}>{item.name}</Text>
      
      {selectedFriends.includes(item.id) && (
        <Icon name="checkmark-circle" size={24} color="#1E90FF" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau groupe</Text>
        <TouchableOpacity onPress={createGroup}>
          <Text style={styles.createButton}>Créer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formGroup}>
        <TextInput
          style={styles.input}
          placeholder="Nom du groupe"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <Text style={styles.sectionTitle}>Sélectionnez des membres</Text>

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.friendsList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E90FF',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formGroup: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  input: {
    fontSize: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 16,
    paddingBottom: 8,
    color: '#333',
  },
  friendsList: {
    paddingHorizontal: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  selectedFriend: {
    backgroundColor: '#f0f8ff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    backgroundColor: '#1E90FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  offlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9E9E9E',
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateGroup;