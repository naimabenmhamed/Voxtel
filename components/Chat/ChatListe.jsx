import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  StatusBar,
  Platform,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const ChatList = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const currentUser = auth().currentUser;
  const [groups, setGroups] = useState([]);
  const [conversations, setConversations] = useState([]);

  const getTimestamp = (timestamp) => {
    if (!timestamp) return 0;
    
    try {
      if (timestamp && typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
      }
      if (timestamp instanceof Date) {
        return timestamp.getTime();
      }
      if (typeof timestamp === 'number') {
        return timestamp;
      }
      if (timestamp && timestamp.seconds) {
        return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
      }
      return 0;
    } catch (error) {
      console.log('Erreur lors de la conversion du timestamp:', error);
      return 0;
    }
  };

  // Fonction pour supprimer un ami
  const deleteFriend = async (friendId, friendName) => {
    Alert.alert(
      "Supprimer l'ami",
      `Êtes-vous sûr de vouloir supprimer ${friendName} de votre liste d'amis ?`,
      [
        {
          text: "Annuler",
          style: "cancel"
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              // Trouver et supprimer la relation d'amitié dans la collection friends
              const friendsQuery = await firestore()
                .collection('friends')
                .where('users', 'array-contains', currentUser.uid)
                .get();

              for (const doc of friendsQuery.docs) {
                const data = doc.data();
                if (data.users && data.users.includes(friendId)) {
                  await firestore().collection('friends').doc(doc.id).delete();
                  break;
                }
              }

              // Optionnel : Supprimer aussi la conversation privée
              const conversationsQuery = await firestore()
                .collection('conversations')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

              for (const doc of conversationsQuery.docs) {
                const data = doc.data();
                if (data.participants && 
                    data.participants.includes(friendId) && 
                    data.participants.length === 2) {
                  await firestore().collection('conversations').doc(doc.id).delete();
                  break;
                }
              }

              Alert.alert("Succès", `${friendName} a été supprimé de votre liste d'amis.`);
            } catch (error) {
              console.log('Erreur lors de la suppression de l\'ami:', error);
              Alert.alert("Erreur", "Impossible de supprimer cet ami. Veuillez réessayer.");
            }
          }
        }
      ]
    );
  };

  // Filtrer pour ne garder que les utilisateurs qui sont dans la collection friends
  const combinedList = [...groups, ...friends, ...conversations]
    .filter((item, index, self) => {
      // Supprimer les doublons
      const isUnique = index === self.findIndex(t => t.id === item.id);
      
      // Pour les conversations individuelles, vérifier qu'ils sont amis
      if (!item.isGroup && !item.conversationId) {
        // Si c'est un ami direct de la collection friends, on le garde
        return isUnique;
      }
      
      // Pour les conversations, vérifier qu'ils sont toujours amis
      if (!item.isGroup && item.conversationId) {
        // Vérifier si l'utilisateur est toujours dans la liste d'amis
        const isFriend = friends.some(friend => friend.id === item.id);
        return isUnique && isFriend;
      }
      
      // Pour les groupes, toujours garder
      return isUnique;
    })
    .sort((a, b) => {
      if (a.hasUnreadMessages && !b.hasUnreadMessages) return -1;
      if (!a.hasUnreadMessages && b.hasUnreadMessages) return 1;
      
      const aTime = a.lastMessageTime || 0;
      const bTime = b.lastMessageTime || 0;
      return bTime - aTime;
    });

  const goToCreateGroup = () => {
    navigation.navigate('CreateGroup');
  };

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribeConversations = firestore()
      .collection('conversations')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        try {
          const conversationsData = await Promise.all(
            snapshot.docs.map(async (doc) => {
              try {
                const data = doc.data();
                if (!Array.isArray(data.participants) || data.participants.length < 2) {
                  console.log('Participants invalides ou manquants pour:', doc.id, data.participants);
                  return null;
                }

                const otherUserId = data.participants.find(uid => uid !== currentUser.uid);
                if (!otherUserId) {
                  console.log('Aucun autre utilisateur trouvé dans la conversation:', doc.id, data.participants);
                  return null;
                }

                // Vérifier si l'utilisateur est toujours un ami
                const friendsQuery = await firestore()
                  .collection('friends')
                  .where('users', 'array-contains', currentUser.uid)
                  .get();

                let isFriend = false;
                for (const friendDoc of friendsQuery.docs) {
                  const friendData = friendDoc.data();
                  if (friendData.users && friendData.users.includes(otherUserId)) {
                    isFriend = true;
                    break;
                  }
                }

                // Si ce n'est plus un ami, ne pas inclure cette conversation
                if (!isFriend) {
                  return null;
                }

                const userDoc = await firestore().collection('users').doc(otherUserId).get();

                const lastMessage = {
                  text: data.lastMessage || '',
                  senderId: data.lastMessageSender || '',
                  timestamp: data.lastMessageTime || null,
                };
                const lastMessageTime = getTimestamp(lastMessage.timestamp);
                const unreadCount = 0;

                if (userDoc.exists) {
                  const userData = userDoc.data();
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
                    id: otherUserId,
                    conversationId: doc.id,
                    name: userData?.nom || userData?.displayName || 'Ami',
                    avatar: avatarUrl,
                    isOnline: userData?.isOnline === true,
                    isGroup: false,
                    hasUnreadMessages: unreadCount > 0,
                    unreadCount: unreadCount,
                    lastMessage: lastMessage?.text || '',
                    lastMessageTime: lastMessageTime,
                    lastMessageSender: lastMessage?.senderId
                  };
                }

                return null;
              } catch (error) {
                console.log('Erreur lors du traitement d\'une conversation:', error);
                return null;
              }
            })
          );

          setConversations(conversationsData.filter(c => c !== null));
          
        } catch (error) {
          console.log('Erreur lors de la récupération des conversations:', error);
        }
      });

    const unsubscribeFriends = firestore()
      .collection('friends')
      .where('users', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        try {
          const friendsData = await Promise.all(
            snapshot.docs.map(async (doc) => {
              try {
                const data = doc.data();
                const friendId = data.users?.find(uid => uid !== currentUser.uid);
                
                if (!friendId) return null;

                const userDoc = await firestore().collection('users').doc(friendId).get();
                if (userDoc.exists) {
                  const userData = userDoc.data();
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
                    name: userData?.nom || userData?.displayName || 'Ami',
                    avatar: avatarUrl,
                    isOnline: userData?.isOnline || false,
                    isGroup: false,
                    hasUnreadMessages: false,
                    unreadCount: 0,
                    lastMessage: '',
                    lastMessageTime: 0
                  };
                }
                return null;
              } catch (error) {
                console.log('Erreur lors du traitement d\'un ami:', error);
                return null;
              }
            })
          );
          setFriends(friendsData.filter(f => f !== null));
          setLoading(false);
        } catch (error) {
          console.log('Erreur lors de la récupération des amis:', error);
          setLoading(false);
        }
      });

    const unsubscribeGroups = firestore()
      .collection('groups')
      .where('members', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        try {
          const groupData = await Promise.all(
            snapshot.docs.map(async (doc) => {
              try {
                const data = doc.data();
                
                const lastMessage = {
                  text: data.lastMessage || '',
                  senderId: data.lastMessageSender || '',
                  timestamp: data.lastMessageTime || null,
                };
                const lastMessageTime = getTimestamp(lastMessage.timestamp);
                const unreadCount = 0;

                return {
                  id: doc.id,
                  name: data.name || 'Groupe',
                  avatar: data.avatar || null,
                  isGroup: true,
                  hasUnreadMessages: unreadCount > 0,
                  unreadCount: unreadCount,
                  lastMessage: lastMessage?.text || '',
                  lastMessageTime: lastMessageTime,
                  lastMessageSender: lastMessage?.senderId
                };
              } catch (error) {
                console.log('Erreur lors du traitement d\'un groupe:', error);
                return null;
              }
            })
          );
          setGroups(groupData.filter(g => g !== null));
        } catch (error) {
          console.log('Erreur lors de la récupération des groupes:', error);
        }
      });

    return () => {
      unsubscribeConversations();
      unsubscribeFriends();
      unsubscribeGroups();
    };
  }, [currentUser?.uid]);

  const startChat = (friend) => {
    navigation.navigate('Chat2p', {
      recipientId: friend.id,
      recipientName: friend.name,
      otherUserAvatar: friend.avatar,
      conversationId: friend.conversationId
    });
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp|| timestamp === 0) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(timestamp);
      
      if (isNaN(messageDate.getTime())) return '';
      
      const diffInMinutes = (now - messageDate) / (1000 * 60);
      const diffInHours = diffInMinutes / 60;
      const diffInDays = diffInHours / 24;
      
      if (diffInMinutes < 1) {
        return 'À l\'instant';
      } else if (diffInMinutes < 60) {
        return `${Math.floor(diffInMinutes)}min`;
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h`;
      } else if (diffInDays < 7) {
        return messageDate.toLocaleDateString('fr-FR', { weekday: 'short' });
      } else {
        return messageDate.toLocaleDateString('fr-FR', { 
          day: 'numeric', 
          month: 'short' 
        });
      }
    } catch (error) {
      console.log('Erreur lors du formatage de l\'heure:', error);
      return '';
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.friendItem,
        item.hasUnreadMessages && styles.unreadItem
      ]}
      onPress={() => {
        if (item.isGroup) {
          navigation.navigate('GroupChat', {
            groupId: item.id,
            groupName: item.name
          });
        } else {
          startChat(item);
        }
      }}
      onLongPress={() => {
        if (!item.isGroup) {
          deleteFriend(item.id, item.name);
        }
      }}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image 
            source={{ uri: item.avatar }} 
            style={styles.avatar}
            onError={(e) => {
              console.log("Erreur de chargement de l'avatar:", e.nativeEvent.error);
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.name ? item.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
        
        {item.hasUnreadMessages && item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.friendInfo}>
        <View style={styles.nameTimeContainer}>
          <Text style={[
            styles.friendName, 
            item.hasUnreadMessages && styles.unreadName
          ]}>
            {item.name || 'Utilisateur'}
          </Text>
          {item.lastMessageTime > 0 && (
            <Text style={styles.timeText}>
              {formatLastMessageTime(item.lastMessageTime)}
            </Text>
          )}
        </View>
        
        <View style={styles.messagePreviewContainer}>
          <Text style={[
            styles.friendStatus,
            item.hasUnreadMessages && styles.unreadMessage
          ]} numberOfLines={1}>
            {item.lastMessage
              ? (item.lastMessageSender === currentUser.uid
                  ? `Vous: ${item.lastMessage}`
                  : item.isGroup
                    ? item.lastMessage
                    : item.lastMessage)
              : ''
            }
          </Text>
        </View>
      </View>

      <View style={styles.rightContainer}>
        <Icon
          name={item.isGroup ? 'people-outline' : 'chatbox-ellipses-outline'}
          size={24}
          color={item.hasUnreadMessages ? "#1E90FF" : "#999"}
        />
        {item.hasUnreadMessages && (
          <View style={styles.newMessageIndicator} />
        )}
        {!item.isGroup && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteFriend(item.id, item.name)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="trash-outline" size={16} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement des conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity 
          style={styles.createGroupButton} 
          onPress={goToCreateGroup}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="people-outline" size={24} color="#1E90FF" />
          <Text style={styles.createGroupText}>GP</Text>
        </TouchableOpacity>
        <Text style={styles.subtitle}>
          {combinedList.length} conversation{combinedList.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <FlatList
        data={combinedList}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={combinedList.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chatbubbles-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySubText}>
              Ajoutez des amis ou rejoignez un groupe pour commencer à chatter
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => navigation.navigate('AddToChat')}
      >
        <Icon name="person-add-outline" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginTop: 4,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    backgroundColor: '#fff',
  },
  unreadItem: {
    backgroundColor: '#f8f9ff',
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
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  friendInfo: {
    flex: 1,
  },
  nameTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadName: {
    fontWeight: 'bold',
    color: '#000',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  friendStatus: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    opacity: 1,
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#333',
  },
  rightContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  newMessageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E90FF',
    marginTop: 4,
  },
  deleteButton: {
    marginTop: 4,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1E90FF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  createGroupButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    alignItems: 'center',
  },
  createGroupText: {
    color: '#1E90FF',
    fontWeight: '600',
    marginTop: 2,
    fontSize: 10,
  },
});

export default ChatList;