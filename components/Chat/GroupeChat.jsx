import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList,
  StyleSheet, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView
} from 'react-native';
import Firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';

const GroupChat = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [userNotes, setUserNotes] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const currentUser = auth().currentUser;
  const flatListRef = useRef(null);

  // Fonction pour récupérer les notes de l'utilisateur
  const fetchUserNotes = async () => {
    try {
      const querySnapshot = await Firestore()
        .collection('notes')
        .where('userId', '==', currentUser.uid)
        .get();

      const notes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => b.createdAt - a.createdAt);

      setUserNotes(notes);
    } catch (error) {
      console.error("Erreur lors de la récupération des notes:", error);
    }
  };

  // Fonction pour récupérer les membres du groupe
  const fetchGroupMembers = async () => {
    try {
      const groupDoc = await Firestore().collection('groups').doc(groupId).get();
      if (groupDoc.exists) {
        const members = groupDoc.data().members || [];
        setGroupMembers(members);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des membres:", error);
    }
  };

  // Fonction pour partager une note dans le groupe
  // Fonction pour partager une note dans le groupe - VERSION CORRIGEE
const shareNote = async (note) => {
  try {
    // Vérifier que la note existe et a les champs requis
    if (!note || !note.id || !note.title) {
      throw new Error("Note invalide - certains champs requis sont manquants");
    }

    // Préparer l'objet de la note partagée avec des valeurs par défaut pour éviter undefined
    const sharedNoteData = {
      id: note.id,
      title: note.title || "Sans titre",
      leçon: note.leçon || "",
      createdAt: note.createdAt || Firestore.FieldValue.serverTimestamp(),
      visibility: note.visibility || "private",
      sharedBy: currentUser.uid,
      sharedByName: currentUser.displayName || 'Utilisateur',
      // Ajouter d'autres champs avec des valeurs par défaut si nécessaire
      ingredient: note.ingredient || "",
      image: note.image || null
    };

    // Vérifier que tous les champs ont des valeurs valides
    Object.keys(sharedNoteData).forEach(key => {
      if (sharedNoteData[key] === undefined) {
        sharedNoteData[key] = null; // Remplacer undefined par null
      }
    });

    await Firestore()
      .collection('groups')
      .doc(groupId)
      .collection('messages')
      .add({
        text: `📝 Note partagée: ${sharedNoteData.title}`,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Utilisateur',
        createdAt: Firestore.FieldValue.serverTimestamp(),
        messageType: 'shared_note',
        sharedNote: sharedNoteData,
        readBy: [currentUser.uid] // Ajouter l'utilisateur courant comme ayant lu le message
      });

    // Mettre à jour le dernier message du groupe
    await Firestore()
      .collection('groups')
      .doc(groupId)
      .update({
        lastMessage: `📝 Note partagée: ${sharedNoteData.title}`,
        lastMessageSender: currentUser.uid,
        updatedAt: Firestore.FieldValue.serverTimestamp()
      });

    setShowNotesModal(false);
    Alert.alert("Succès", "Note partagée avec succès dans le groupe!");
  } catch (error) {
    console.error("Erreur lors du partage:", error);
    Alert.alert(
      "Erreur", 
      error.message || "Impossible de partager la note",
      [{ text: "OK" }]
    );
  }
};

  const markMessagesAsRead = async () => {
    const messagesRef = Firestore()
      .collection('groups')
      .doc(groupId)
      .collection('messages')
      .where('readBy', 'not-in', [currentUser.uid])
      .get();

    const batch = Firestore().batch();

    (await messagesRef).forEach((doc) => {
      batch.update(doc.ref, {
        readBy: Firestore.FieldValue.arrayUnion(currentUser.uid)
      });
    });

    await batch.commit();
  };

  const setupGroupListener = () => {
    return Firestore()
      .collection('groups')
      .doc(groupId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        (snapshot) => {
          const msgs = [];
          snapshot.forEach((doc) => {
            msgs.push({
              id: doc.id,
              ...doc.data()
            });
          });
          setMessages(msgs);
          markMessagesAsRead();
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 200);
        },
        (error) => {
          console.error("Message listener error:", error);
          Alert.alert("Error", "Failed to load messages");
        }
      );
  };

  useEffect(() => {
    if (!currentUser) return;

    fetchGroupMembers();
    const unsubscribe = setupGroupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId, currentUser]);

  const sendMessage = async () => {
    if (!messageText.trim() || !currentUser) return;

    try {
      await Firestore()
        .collection('groups')
        .doc(groupId)
        .collection('messages')
        .add({
          text: messageText,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Utilisateur',
          createdAt: Firestore.FieldValue.serverTimestamp(),
          readBy: [currentUser.uid],
          messageType: 'text'
        });

      // Mettre à jour le dernier message du groupe
      await Firestore()
        .collection('groups')
        .doc(groupId)
        .update({
          lastMessage: messageText,
          lastMessageSender: currentUser.uid,
          updatedAt: Firestore.FieldValue.serverTimestamp()
        });

      setMessageText('');
    } catch (error) {
      console.error("Send message error:", error);
      Alert.alert("Erreur", "Impossible d'envoyer le message");
    }
  };

  const formatDate = (firebaseDate) => {
    if (!firebaseDate || !firebaseDate.toDate) return '';
    const d = firebaseDate.toDate();
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const showSharedNoteDetails = (sharedNote) => {
    if (!sharedNote) return;

    Alert.alert(
      sharedNote.title,
      `${sharedNote.description}\n\nPartagée par: ${sharedNote.sharedByName}\nDate de création: ${formatDate(sharedNote.createdAt)}`,
      [
        { 
          text: "Voir détails", 
          onPress: () => {
            navigation.navigate('AfficherNotes', { 
              note: {
                id: sharedNote.id,
                title: sharedNote.title,
                 leçon: sharedNote.leçon || '',
                createdAt: sharedNote.createdAt,
                visibility: sharedNote.visibility,
                image: sharedNote.image || null,
              }
            });
          } 
        },
        { text: "Fermer", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === currentUser?.uid;
    const messageDate = item.createdAt?.toDate() || new Date();
    const isSharedNote = item.messageType === 'shared_note';

    return (
      <View
        style={[
          styles.messageWrapper,
          isCurrentUser ? styles.messageRight : styles.messageLeft
        ]}
      >
        {!isCurrentUser && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        
        <TouchableOpacity
          style={[
            styles.bubble,
            isCurrentUser ? styles.bubbleRight : styles.bubbleLeft,
            isSharedNote && styles.sharedNoteBubble
          ]}
          onPress={isSharedNote ? () => showSharedNoteDetails(item.sharedNote) : undefined}
          disabled={!isSharedNote}
        >
          {isSharedNote && (
            <View style={styles.sharedNoteHeader}>
              <Icon name="document-text" size={16} color="#1E90FF" />
              <Text style={styles.sharedNoteLabel}>Note partagée</Text>
            </View>
          )}
          
          <Text style={[styles.messageText, isCurrentUser ? styles.textRight : styles.textLeft]}>
            {item.text}
          </Text>
          
          {isSharedNote && (
            <Text style={styles.sharedNoteDescription} numberOfLines={2}>
              {item.sharedNote.description}
            </Text>
          )}
          
          <View style={styles.metaInfo}>
            <Text style={[styles.timeText, isCurrentUser ? styles.textRight : styles.textLeft]}>
              {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isCurrentUser && (
              <Icon
                name={item.readBy?.length > 1 ? "checkmark-done" : "checkmark"}
                size={16}
                color={item.readBy?.length > 1 ? "#4FC3F7" : "white"}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
          
          <View style={[
            styles.tail,
            isCurrentUser ? styles.tailRight : styles.tailLeft
          ]} />
        </TouchableOpacity>
      </View>
    );
  };

  const NotesModal = () => (
    <Modal
      visible={showNotesModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowNotesModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choisir une note à partager</Text>
            <TouchableOpacity onPress={() => setShowNotesModal(false)}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.notesContainer}>
            {userNotes.map((note) => (
              <TouchableOpacity
                key={note.id}
                style={styles.noteItem}
                onPress={() => shareNote(note)}
              >
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle} numberOfLines={1}>
                    {note.title}
                  </Text>
                  <Text style={styles.noteDescription} numberOfLines={2}>
                    {note.description}
                  </Text>
                  <View style={styles.noteFooter}>
                    <Text style={styles.noteDate}>
                      {formatDate(note.createdAt)}
                    </Text>
                    <View style={styles.visibilityBadge}>
                      <Icon 
                        name={note.visibility === 'public' ? 'globe' : 'lock-closed'} 
                        size={12} 
                        color="#666" 
                      />
                      <Text style={styles.visibilityText}>
                        {note.visibility === 'public' ? 'Public' : 'Privé'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Icon name="share" size={20} color="#1E90FF" />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {userNotes.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="document-text" size={50} color="#ccc" />
              <Text style={styles.emptyText}>Aucune note disponible</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'android' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>{groupName}</Text>
          <Text style={styles.memberCount}>{groupMembers.length} membres</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('GroupInfo', { groupId })}>
          <Icon name="information-circle-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={() => {
            fetchUserNotes();
            setShowNotesModal(true);
          }}
        >
          <Icon name="document-text" size={20} color="#1E90FF" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Écrivez un message..."
          multiline
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, !messageText.trim() && {opacity: 0.5}]}
          onPress={sendMessage}
          disabled={!messageText.trim()}
        >
          <Icon name="send" style={styles.sendButtonText} size={23} />
        </TouchableOpacity>
      </View>

      <NotesModal />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#1E90FF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: 'center',
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberCount: {
    color: 'white',
    fontSize: 12,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    marginLeft: 10,
  },
  messagesList: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  messageWrapper: {
    marginBottom: 10,
    flexDirection: 'column',
  },
  messageLeft: {
    alignItems: 'flex-start',
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    position: 'relative',
  },
  bubbleLeft: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleRight: {
    backgroundColor: '#1E90FF',
    borderTopRightRadius: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sharedNoteBubble: {
    borderWidth: 1,
    borderColor: '#1E90FF',
  },
  sharedNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sharedNoteLabel: {
    fontSize: 12,
    color: '#1E90FF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sharedNoteDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 16,
  },
  textLeft: {
    color: '#333',
  },
  textRight: {
    color: 'white',
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    opacity: 0.7,
  },
  tail: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 15,
    borderTopColor: 'transparent',
  },
  tailLeft: {
    left: -8,
    borderRightWidth: 10,
    borderRightColor: '#fff',
    borderBottomWidth: 15,
    borderBottomColor: 'transparent',
  },
  tailRight: {
    right: -8,
    borderLeftWidth: 10,
    borderLeftColor: '#1E90FF',
    borderBottomWidth: 15,
    borderBottomColor: 'transparent',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'flex-end',
  },
  shareButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  sendButton: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#1E90FF',
    borderRadius: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
    fontWeight: 'bold',
    color: '#333',
  },
  notesContainer: {
    maxHeight: 400,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  noteContent: {
    flex: 1,
    marginRight: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  noteDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
});

export default GroupChat;