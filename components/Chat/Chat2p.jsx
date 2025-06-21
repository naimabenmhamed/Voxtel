import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StatusBar,
  Modal,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';

const Chat2p = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState(null);
  const [showNoteShareModal, setShowNoteShareModal] = useState(false);
  const [userNotes, setUserNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [recipientData, setRecipientData] = useState(null);
  const flatListRef = useRef(null);
  const [selectedNote, setSelectedNote] = useState(null);
const [showNoteViewModal, setShowNoteViewModal] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const currentUser = auth().currentUser;
  
  const { recipientId, recipientName, otherUserAvatar, conversationId: routeConversationId } = route.params;
const handleViewNote = useCallback((note) => {
  setSelectedNote(note);
  setShowNoteViewModal(true);
}, []);
  // Fonction pour obtenir le timestamp en millisecondes
  const getTimestamp = useCallback((timestamp) => {
    if (!timestamp) return Date.now();
    
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
      return Date.now();
    } catch (error) {
      console.log('Erreur lors de la conversion du timestamp:', error);
      return Date.now();
    }
  }, []);
// Écouter les messages en temps réel
useEffect(() => {
  if (!conversationId) return;

  // Solution recommandée : utiliser une sous-collection
  const unsubscribe = firestore()
    .collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(
      (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: getTimestamp(doc.data().timestamp)
        }));
        
        setMessages(messagesData);
        markMessagesAsRead();
      },
      (error) => {
        console.error('Erreur lors de l\'écoute des messages:', error);
      }
    );

  return () => unsubscribe();
}, [conversationId, getTimestamp]);
  // Fonction pour formater l'heure d'affichage
  const formatMessageTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const messageDate = new Date(timestamp);
      if (isNaN(messageDate.getTime())) return '';
      
      return messageDate.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.log('Erreur lors du formatage de l\'heure:', error);
      return '';
    }
  }, []);

  // Charger les données du destinataire
  useEffect(() => {
    const fetchRecipientData = async () => {
      try {
        const recipientDoc = await firestore()
          .collection('users')
          .doc(recipientId)
          .get();
        
        if (recipientDoc.exists) {
          setRecipientData(recipientDoc.data());
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données du destinataire:', error);
      }
    };

    fetchRecipientData();
  }, [recipientId]);

  // Initialiser ou récupérer la conversation
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        if (routeConversationId) {
          setConversationId(routeConversationId);
          setLoading(false);
          return;
        }

        // Vérifier si une conversation existe déjà
        const participants = [currentUser.uid, recipientId].sort();
        const querySnapshot = await firestore()
          .collection('conversations')
          .where('participants', '==', participants)
          .limit(1)
          .get();

        if (!querySnapshot.empty) {
          setConversationId(querySnapshot.docs[0].id);
        } else {
          // Créer une nouvelle conversation
          const newConversationRef = await firestore()
            .collection('conversations')
            .add({
              participants: participants,
              participantNames: {
                [currentUser.uid]: currentUser.displayName || 'Moi',
                [recipientId]: recipientName
              },
              createdAt: firestore.FieldValue.serverTimestamp(),
              updatedAt: firestore.FieldValue.serverTimestamp(),
              lastMessage: '',
              lastMessageSender: '',
              lastMessageTime: firestore.FieldValue.serverTimestamp()
            });
          
          setConversationId(newConversationRef.id);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de la conversation:', error);
        Alert.alert('Erreur', 'Impossible de charger la conversation');
        setLoading(false);
      }
    };

    initializeConversation();
  }, [currentUser, recipientId, recipientName, routeConversationId]);

  // Écouter les messages en temps réel
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = firestore()
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        (snapshot) => {
          const messagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: getTimestamp(doc.data().timestamp)
          }));
          
          setMessages(messagesData);
          markMessagesAsRead();
        },
        (error) => {
          console.error('Erreur lors de l\'écoute des messages:', error);
        }
      );

    return () => unsubscribe();
  }, [conversationId, getTimestamp]);

  // Marquer les messages comme lus
  const markMessagesAsRead = useCallback(async () => {
    if (!conversationId || !currentUser) return;
    
    try {
      const unreadMessages = await firestore()
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .where('senderId', '==', recipientId)
        .where('readBy', 'array-contains', currentUser.uid)
        .get();

      if (!unreadMessages.empty) return;

      const batch = firestore().batch();
      const messagesToMark = await firestore()
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .where('senderId', '==', recipientId)
        .where('readBy', 'array-contains', currentUser.uid)
        .get();

      messagesToMark.forEach(doc => {
        batch.update(doc.ref, {
          readBy: firestore.FieldValue.arrayUnion(currentUser.uid)
        });
      });

      if (!messagesToMark.empty) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  }, [conversationId, currentUser, recipientId]);

  // Charger les notes de l'utilisateur
  const loadUserNotes = useCallback(async () => {
    if (!currentUser) return;
    
    setLoadingNotes(true);
    try {
      const notesQuery = await firestore()
        .collection('notes')
        .where('userId', '==', currentUser.uid)
        .orderBy('updatedAt', 'desc')
        .get();

      const notes = notesQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setUserNotes(notes);
    } catch (error) {
      console.error('Erreur lors du chargement des notes:', error);
      Alert.alert('Erreur', 'Impossible de charger les notes');
    } finally {
      setLoadingNotes(false);
    }
  }, [currentUser]);

  // Partager une note
  const shareNote = useCallback(async (note) => {
    if (!conversationId || !currentUser) return;

    try {
      await firestore().collection('messages').add({
        conversationId: conversationId,
        text: `📝 Note partagée: ${note.title}`,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Moi',
        timestamp: firestore.FieldValue.serverTimestamp(),
        readBy: [currentUser.uid],
        type: 'note_share',
        sharedNote: {
          id: note.id,
          title: note.title,
          leçon: note.leçon,
          userName: note.userName || currentUser.displayName,
          image: note.image
        }
      });

      // Mettre à jour la conversation
      await firestore().collection('conversations').doc(conversationId).update({
        updatedAt: firestore.FieldValue.serverTimestamp(),
        lastMessage: `📝 Note partagée: ${note.title}`,
        lastMessageSender: currentUser.uid,
        lastMessageTime: firestore.FieldValue.serverTimestamp()
      });

      setShowNoteShareModal(false);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Erreur lors du partage de la note:', error);
      Alert.alert('Erreur', 'Impossible de partager la note');
    }
  }, [conversationId, currentUser]);

  // Envoyer un message
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !conversationId || !currentUser) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      await firestore().collection('messages').add({
        conversationId: conversationId,
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Moi',
        timestamp: firestore.FieldValue.serverTimestamp(),
        readBy: [currentUser.uid],
        type: 'text'
      });

      // Mettre à jour la conversation
      await firestore().collection('conversations').doc(conversationId).update({
        updatedAt: firestore.FieldValue.serverTimestamp(),
        lastMessage: messageText,
        lastMessageSender: currentUser.uid,
        lastMessageTime: firestore.FieldValue.serverTimestamp()
      });

      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      setInputText(messageText); // Restore message if failed
    }
  }, [inputText, conversationId, currentUser]);

  // Rendu d'un message
  const renderMessage = useCallback(({ item }) => {
    const isMyMessage = item.senderId === currentUser?.uid;
    const avatarSource = isMyMessage 
      ? currentUser?.photoURL 
      : recipientData?.photoURL || otherUserAvatar;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {!isMyMessage && avatarSource && (
          <Image 
            source={{ uri: avatarSource }} 
            style={styles.messageAvatar}
            onError={(e) => console.log("Erreur avatar message:", e.nativeEvent.error)}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          {item.type === 'note_share' && item.sharedNote ? (
            <View style={styles.sharedNoteContainer}>
              <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                {item.text}
              </Text>
              <TouchableOpacity 
                style={[
                  styles.notePreview,
                  isMyMessage ? styles.myNotePreview : styles.otherNotePreview
                ]}
                activeOpacity={0.7}
                onPress={() => handleViewNote(item.sharedNote)}
              >
                <Text style={[
                  styles.noteTitle,
                  isMyMessage ? styles.myNoteTitle : styles.otherNoteTitle
                ]}>
                  {item.sharedNote.title}
                </Text>
                {item.sharedNote.leçon && (
                  <Text style={[
                    styles.noteContent,
                    isMyMessage ? styles.myNoteContent : styles.otherNoteContent
                  ]} numberOfLines={3}>
                    {item.sharedNote.leçon}
                  </Text>
                )}
                {item.sharedNote.image && (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${item.sharedNote.image}` }}
                    style={styles.noteImage}
                    resizeMode="cover"
                  />
                )}
                <Text style={[
                  styles.noteAuthor,
                  isMyMessage ? styles.myNoteAuthor : styles.otherNoteAuthor
                ]}>
                  Par: {item.sharedNote.userName}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </Text>
          )}
          
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatMessageTime(item.timestamp)}
            {!isMyMessage && item.readBy?.includes(currentUser?.uid) && ' ✓'}
          </Text>
        </View>
      </View>
    );
  }, [currentUser, recipientData, otherUserAvatar, formatMessageTime]);

  // Rendu d'une note dans la modal
  const renderNoteItem = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.noteItem}
      onPress={() => shareNote(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.noteItemTitle}>{item.title}</Text>
      {item.leçon && (
        <Text style={styles.noteItemContent} numberOfLines={2}>
          {item.leçon}
        </Text>
      )}
      {item.image && (
        <Image 
          source={{ uri: `data:image/jpeg;base64,${item.image}` }}
          style={styles.noteItemImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.shareButton}>
        <Icon name="share-outline" size={16} color="#1E90FF" />
        <Text style={styles.shareButtonText}>Partager</Text>
      </View>
    </TouchableOpacity>
  ), [shareNote]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#1E90FF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          {(recipientData?.photoURL || otherUserAvatar) && (
            <Image 
              source={{ uri: recipientData?.photoURL || otherUserAvatar }} 
              style={styles.headerAvatar}
              onError={(e) => console.log("Erreur avatar header:", e.nativeEvent.error)}
            />
          )}
          <Text style={styles.headerTitle}>{recipientData?.displayName || recipientName}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.shareNotesButton}
          onPress={() => {
            setShowNoteShareModal(true);
            loadUserNotes();
          }}
        >
          <Icon name="document-text-outline" size={24} color="#1E90FF" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chatbubbles-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Aucun message</Text>
            <Text style={styles.emptySubText}>
              Commencez la conversation avec {recipientData?.displayName || recipientName}
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Tapez votre message..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
          onSubmitEditing={sendMessage}
          // blurOnSubmit={false}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Icon 
            name="send" 
            size={20} 
            color={inputText.trim() ? "#fff" : "#ccc"} 
          />
        </TouchableOpacity>
      </View>

      {/* Modal de partage de notes */}
      <Modal
        visible={showNoteShareModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNoteShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Partager une note</Text>
            <TouchableOpacity
              onPress={() => setShowNoteShareModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {loadingNotes ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color="#1E90FF" />
            </View>
          ) : userNotes.length === 0 ? (
            <View style={styles.modalEmptyContainer}>
              <Icon name="document-outline" size={60} color="#ccc" />
              <Text style={styles.modalEmptyText}>Aucune note disponible</Text>
              <Text style={styles.modalEmptySubText}>
                Créez d'abord des notes pour les partager
              </Text>
            </View>
          ) : (
            <FlatList
              data={userNotes}
              renderItem={renderNoteItem}
              keyExtractor={(item) => item.id}
              style={styles.notesList}
              contentContainerStyle={styles.notesListContainer}
            />
          )}
        </View>
      </Modal>
      {/* Modal pour afficher la note complète */}
<Modal
  visible={showNoteViewModal}
  animationType="slide"
  transparent={false}
  onRequestClose={() => setShowNoteViewModal(false)}
>
  <View style={styles.modalContainer}>
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>Note partagée</Text>
      <TouchableOpacity
        onPress={() => setShowNoteViewModal(false)}
        style={styles.modalCloseButton}
      >
        <Icon name="close" size={24} color="#333" />
      </TouchableOpacity>
    </View>
    
    {selectedNote && (
      <View style={styles.fullNoteContainer}>
        <Text style={styles.fullNoteTitle}>{selectedNote.title}</Text>
        
        {selectedNote.leçon && (
          <Text style={styles.fullNoteContent}>{selectedNote.leçon}</Text>
        )}
        
        {selectedNote.image && (
          <Image 
            source={{ uri: `data:image/jpeg;base64,${selectedNote.image}` }}
            style={styles.fullNoteImage}
            resizeMode="contain"
          />
        )}
        
        <View style={styles.fullNoteFooter}>
          <Text style={styles.fullNoteAuthor}>
            Par: {selectedNote.userName}
          </Text>
        </View>
      </View>
    )}
  </View>
</Modal>
    </KeyboardAvoidingView>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  shareNotesButton: {
    padding: 8,
    marginLeft: 8,
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myMessageBubble: {
    backgroundColor: '#1E90FF',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
    textAlign: 'left',
  },
  sharedNoteContainer: {
    width: '100%',
  },
  notePreview: {
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  myNotePreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  otherNotePreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  myNoteTitle: {
    color: '#fff',
  },
  otherNoteTitle: {
    color: '#333',
  },
  noteContent: {
    fontSize: 12,
    marginBottom: 4,
  },
  myNoteContent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  otherNoteContent: {
    color: '#666',
  },
  noteImage: {
    width: '100%',
    height: 100,
    borderRadius: 4,
    marginVertical: 4,
  },
  noteAuthor: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  myNoteAuthor: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherNoteAuthor: {
    color: '#999',
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
  fullNoteContainer: {
  flex: 1,
  padding: 20,
},
fullNoteTitle: {
  fontSize: 22,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 20,
  textAlign: 'center',
},
fullNoteContent: {
  fontSize: 16,
  color: '#555',
  lineHeight: 24,
  marginBottom: 20,
},
fullNoteImage: {
  width: '100%',
  height: 300,
  borderRadius: 8,
  marginBottom: 20,
},
fullNoteFooter: {
  borderTopWidth: 1,
  borderTopColor: '#eee',
  paddingTop: 10,
},
fullNoteAuthor: {
  fontSize: 14,
  color: '#888',
  fontStyle: 'italic',
},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 120,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#1E90FF',
  },
  sendButtonInactive: {
    backgroundColor: '#f0f0f0',
  },
  // Styles pour la modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  modalEmptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  modalEmptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  notesList: {
    flex: 1,
    backgroundColor: '#fff',
  },
  notesListContainer: {
    padding: 16,
  },
  noteItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  noteItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noteItemContent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  noteItemImage: {
    width: '100%',
    height: 120,
    borderRadius: 4,
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  shareButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#1E90FF',
    fontWeight: '500',
  },
});

export default Chat2p;