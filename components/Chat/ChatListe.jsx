import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  StatusBar,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const ChatList = () => {
  const [combinedList, setCombinedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const currentUser = auth().currentUser;

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

  const getAvatarUrl = (userData) => {
    if (userData?.photoURL) {
      return userData.photoURL;
    } else if (userData?.photoProfil) {
      if (userData.photoProfil.startsWith('data:image')) {
        return userData.photoProfil;
      } else if (userData.photoProfil.startsWith('/9j/')) {
        return `data:image/jpeg;base64,${userData.photoProfil}`;
      } else {
        return userData.photoProfil;
      }
    } else if (userData?.avatar) {
      return userData.avatar;
    }
    return null;
  };

  // Nouvelle fonction pour récupérer le dernier message d'une conversation avec un ami
  const getLastMessageForFriend = async (friendId) => {
    try {
      // Vérifier d'abord si cet utilisateur est bien dans la collection friends
      const friendQuery = await firestore()
        .collection('friends')
        .where('users', 'array-contains', currentUser.uid)
        .get();

      let isFriend = false;
      for (const doc of friendQuery.docs) {
        const data = doc.data();
        if (data.users && data.users.includes(friendId)) {
          isFriend = true;
          break;
        }
      }

      // Si ce n'est pas un ami, ne pas récupérer le message
      if (!isFriend) {
        return { lastMessage: null, conversationId: null };
      }

      // Chercher une conversation entre l'utilisateur actuel et cet ami
      const conversationQuery = await firestore()
        .collection('conversations')
        .where('participants', 'array-contains', currentUser.uid)
        .get();

      let lastMessage = null;
      let conversationId = null;

      for (const doc of conversationQuery.docs) {
        const data = doc.data();
        if (data.participants && data.participants.includes(friendId)) {
          conversationId = doc.id;
          
          // Récupérer le dernier message de cette conversation
          const messagesQuery = await firestore()
            .collection('conversations')
            .doc(doc.id)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

          if (!messagesQuery.empty) {
            const messageDoc = messagesQuery.docs[0];
            const messageData = messageDoc.data();
            lastMessage = {
              text: messageData.text || '',
              senderId: messageData.senderId || '',
              timestamp: messageData.timestamp || null,
            };
          }
          break;
        }
      }

      return { lastMessage, conversationId };
    } catch (error) {
      console.log('Erreur lors de la récupération du dernier message:', error);
      return { lastMessage: null, conversationId: null };
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    // Stocker toutes les données dans des Maps pour faciliter la fusion
    const conversationsMap = new Map();
    const friendsMap = new Map();
    const groupsMap = new Map();

    // Fonction pour mettre à jour la liste combinée
    const updateCombinedList = async () => {
      const combined = new Map();

      // D'abord, ajouter toutes les conversations avec leurs derniers messages
      conversationsMap.forEach((conversation, userId) => {
        combined.set(`user_${userId}`, {
          ...conversation,
          type: 'conversation'
        });
      });

      // Ensuite, traiter les amis qui n'ont pas de conversation
      for (const [userId, friend] of friendsMap) {
        if (!combined.has(`user_${userId}`)) {
          // Récupérer le dernier message pour cet ami (seulement s'il est dans friends)
          const { lastMessage, conversationId } = await getLastMessageForFriend(userId);
          
          const lastMessageTime = lastMessage ? getTimestamp(lastMessage.timestamp) : 0;
          const unreadCount = 0; // À adapter selon votre logique

          combined.set(`user_${userId}`, {
            ...friend,
            type: lastMessage ? 'conversation' : 'friend',
            conversationId: conversationId,
            lastMessage: lastMessage?.text || '',
            lastMessageTime: lastMessageTime,
            lastMessageSender: lastMessage?.senderId,
            hasUnreadMessages: unreadCount > 0,
            unreadCount: unreadCount
          });
        } else {
          // Mettre à jour les infos de l'ami existant dans la conversation
          const existing = combined.get(`user_${userId}`);
          combined.set(`user_${userId}`, {
            ...existing,
            name: friend.name || existing.name,
            avatar: friend.avatar || existing.avatar,
            isOnline: friend.isOnline
          });
        }
      }

      // Ajouter les groupes
      groupsMap.forEach((group, groupId) => {
        combined.set(`group_${groupId}`, {
          ...group,
          type: 'group'
        });
      });

      // Convertir en array et trier
      const finalList = Array.from(combined.values()).sort((a, b) => {
        // Messages non lus en premier
        if (a.hasUnreadMessages && !b.hasUnreadMessages) return -1;
        if (!a.hasUnreadMessages && b.hasUnreadMessages) return 1;
        
        // Ensuite par timestamp (les plus récents en premier)
        const aTime = a.lastMessageTime || 0;
        const bTime = b.lastMessageTime || 0;
        
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        
        // Si même timestamp, les conversations avec des messages en premier
        if (a.type === 'conversation' && b.type === 'friend') return -1;
        if (a.type === 'friend' && b.type === 'conversation') return 1;
        
        // Enfin par nom alphabétique
        return (a.name || '').localeCompare(b.name || '');
      });

      setCombinedList(finalList);
      setLoading(false);
    };

    // Écouter les conversations
    const unsubscribeConversations = firestore()
      .collection('conversations')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        try {
          conversationsMap.clear();
          
          await Promise.all(
            snapshot.docs.map(async (doc) => {
              try {
                const data = doc.data();
                if (!Array.isArray(data.participants) || data.participants.length < 2) {
                  return;
                }

                const otherUserId = data.participants.find(uid => uid !== currentUser.uid);
                if (!otherUserId) return;

                const userDoc = await firestore().collection('users').doc(otherUserId).get();
                if (!userDoc.exists) return;

                const userData = userDoc.data();
                const lastMessage = {
                  text: data.lastMessage || '',
                  senderId: data.lastMessageSender || '',
                  timestamp: data.lastMessageTime || null,
                };
                const lastMessageTime = getTimestamp(lastMessage.timestamp);
                const unreadCount = 0; // À adapter selon votre logique

                conversationsMap.set(otherUserId, {
                  id: otherUserId,
                  conversationId: doc.id,
                  name: userData?.nom || userData?.displayName || 'Ami',
                  avatar: getAvatarUrl(userData),
                  isOnline: userData?.isOnline === true,
                  isGroup: false,
                  hasUnreadMessages: unreadCount > 0,
                  unreadCount: unreadCount,
                  lastMessage: lastMessage?.text || '',
                  lastMessageTime: lastMessageTime,
                  lastMessageSender: lastMessage?.senderId
                });
              } catch (error) {
                console.log('Erreur lors du traitement d\'une conversation:', error);
              }
            })
          );
          
          updateCombinedList();
        } catch (error) {
          console.log('Erreur lors de la récupération des conversations:', error);
        }
      });

    // Écouter les amis
    const unsubscribeFriends = firestore()
      .collection('friends')
      .where('users', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        try {
          friendsMap.clear();
          
          await Promise.all(
            snapshot.docs.map(async (doc) => {
              try {
                const data = doc.data();
                const friendId = data.users?.find(uid => uid !== currentUser.uid);
                
                if (!friendId) return;

                const userDoc = await firestore().collection('users').doc(friendId).get();
                if (!userDoc.exists) return;

                const userData = userDoc.data();
                
                friendsMap.set(friendId, {
                  id: friendId,
                  name: userData?.nom || userData?.displayName || 'Ami',
                  avatar: getAvatarUrl(userData),
                  isOnline: userData?.isOnline || false,
                  isGroup: false
                });
              } catch (error) {
                console.log('Erreur lors du traitement d\'un ami:', error);
              }
            })
          );
          
          updateCombinedList();
        } catch (error) {
          console.log('Erreur lors de la récupération des amis:', error);
        }
      });

    // Écouter les groupes
    const unsubscribeGroups = firestore()
      .collection('groups')
      .where('members', 'array-contains', currentUser.uid)
      .onSnapshot(async (snapshot) => {
        try {
          groupsMap.clear();
          
          await Promise.all(
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

                groupsMap.set(doc.id, {
                  id: doc.id,
                  name: data.name || 'Groupe',
                  avatar: data.avatar || null,
                  isGroup: true,
                  hasUnreadMessages: unreadCount > 0,
                  unreadCount: unreadCount,
                  lastMessage: lastMessage?.text || '',
                  lastMessageTime: lastMessageTime,
                  lastMessageSender: lastMessage?.senderId
                });
              } catch (error) {
                console.log('Erreur lors du traitement d\'un groupe:', error);
              }
            })
          );
          
          updateCombinedList();
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

  const goToCreateGroup = () => {
    navigation.navigate('CreateGroup');
  };

  const startChat = (friend) => {
    navigation.navigate('Chat2p', {
      recipientId: friend.id,
      recipientName: friend.name,
      otherUserAvatar: friend.avatar,
      conversationId: friend.conversationId
    });
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp || timestamp === 0) return '';
    
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
                  : item.lastMessage)
              : 'Commencer une conversation'
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
        keyExtractor={(item, index) => `${item.type}-${item.id}` || index.toString()}
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