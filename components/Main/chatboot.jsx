import React, { useState, useEffect, useCallback } from 'react';
import { GiftedChat, Message, Bubble } from 'react-native-gifted-chat';
import { SafeAreaView, StyleSheet } from 'react-native';
import axios from 'axios';

export default function App() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const welcome = {
      _id: 1,
      text: '👋 Bienvenue sur votre chatbot !\n\nChoisissez un numéro :\n1️⃣ Info sur l’application\n2️⃣ Bouton accueil\n3️⃣ Ajouter\n4️⃣ Profil',
      createdAt: new Date(),
      user: {
        _id: 2,
        name: 'Bot',
      },
    };
    setMessages([welcome]);

    // ❌ Suppression de l’appel automatique à l’API
  }, []);

  const onSend = useCallback(async (newMessages = []) => {
    setMessages(previousMessages =>
      GiftedChat.append(previousMessages, newMessages)
    );

    const userMessage = newMessages[0].text;

    try {
      const res = await axios.post('http://192.168.8.110:8000/chat', {
        message: userMessage,
      });

      const botMessage = {
        _id: Math.random().toString(),
        text: res.data.response,
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Bot',
        },
      };

      setMessages(previousMessages =>
        GiftedChat.append(previousMessages, [botMessage])
      );
    } catch (error) {
      console.error("Erreur API:", error.message);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={{ _id: 1 }}
        renderMessage={(props) => {
          const { key, ...rest } = props;
          return <Message key={key || rest.currentMessage._id} {...rest} />;
        }}
        renderBubble={props => (
          <Bubble
            {...props}
            wrapperStyle={{
              left: {
                backgroundColor: '#003366', // bleu foncé pour bot
              },
              right: {
                backgroundColor: '#99CCFF', // bleu clair pour utilisateur
              },
            }}
            textStyle={{
              left: {
                color: '#FFFFFF', // texte blanc bot
              },
              right: {
                color: '#000000', // texte noir utilisateur
              },
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F0FE',
  },
});



