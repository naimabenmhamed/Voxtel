import LottieView from 'lottie-react-native';
import React, { useState } from 'react';
import { View, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Home from '../Main/Home';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password || !nom) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);

    try {
      const cleanedEmail = email.trim().toLowerCase();
      const userCredential = await auth().signInWithEmailAndPassword(cleanedEmail, password);
      const user = userCredential.user;

      // Recharge l’état de l’utilisateur pour avoir la bonne info emailVerified
      await user.reload();

      if (!user.emailVerified) {
        Alert.alert(
          'Email non vérifié',
          'Votre email n\'est pas encore vérifié. Voulez-vous renvoyer l\'email de vérification ?',
          [
            {
              text: 'Annuler',
              style: 'cancel',
              onPress: () => auth().signOut()
            },
            {
              text: 'Renvoyer',
              onPress: async () => {
                try {
                  await user.reload();
                  await user.sendEmailVerification();
                  Alert.alert(
                    'Email envoyé',
                    'Un nouvel email de vérification a été envoyé. Veuillez vérifier votre boîte mail.',
                    [
                      {
                        text: 'OK',
                        onPress: () => auth().signOut()
                      }
                    ]
                  );
                } catch (error) {
                  Alert.alert('Erreur', 'Impossible d\'envoyer l\'email de vérification');
                  auth().signOut();
                }
              }
            }
          ]
        );
        return;
      }

      // Mise à jour Firestore
      await firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          nom: nom,
          emailVerified: true,
          lastLogin: firestore.FieldValue.serverTimestamp()
        });

      Alert.alert('Succès', 'Connexion réussie');
      navigation.navigate('Home');

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      let errorMessage = 'Une erreur est survenue';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Aucun compte trouvé avec cette adresse email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Mot de passe incorrect';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Adresse email invalide';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Ce compte a été désactivé';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard';
          break;
        default:
          errorMessage = error.message;
      }

      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Erreur', 'Veuillez entrer votre adresse email');
      return;
    }

    try {
      const methods = await auth().fetchSignInMethodsForEmail(email);
      if (methods.length === 0) {
        Alert.alert('Erreur', 'Aucun compte trouvé avec cette adresse email');
        return;
      }

      Alert.alert(
        'Renvoyer la vérification',
        'Pour renvoyer l\'email de vérification, vous devez d\'abord vous connecter avec votre mot de passe.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      Alert.alert('Erreur', 'Impossible de vérifier cette adresse email');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topsection}>
        <LottieView 
          source={require('../../assets/animations/Animation - 1748944760221.json')}  
          autoPlay  
          loop
          style={{ width: 244, height: 400 }}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.bottomSection}>
        <TextInput
          placeholder="Nom"
          placeholderTextColor="#999"
          style={styles.input}
          value={nom}
          onChangeText={setNom}
        />
        
        <TextInput  
          placeholder="E-mail"  
          placeholderTextColor="#999"  
          style={styles.input} 
          keyboardType="email-address"   
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        
        <TextInput  
          placeholder="Mot de passe" 
          placeholderTextColor="#999"  
          style={styles.input} 
          secureTextEntry={true}  
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />
           
        <TouchableOpacity 
          style={[styles.roundButton, isLoading && styles.disabledButton]}  
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Connexion...' : 'Connexion'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.linkButton}  
          onPress={handleResendVerification}
        >
          <Text style={styles.linkText}>
            Renvoyer l'email de vérification
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topsection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    backgroundColor: '#1E90FF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40,
    justifyContent: 'space-evenly',
    height: '65%',
  },
  input: {
    backgroundColor: '#FFF5F0',
    borderRadius: 15,
    padding: 15,
    marginVertical: 8,
    borderColor: '#FFF5F0',
    borderWidth: 1,
    marginBottom: 12,
    paddingLeft: 8,
    height: 50,
    color: '#000',
    fontSize: 14,  
  },
  roundButton: {
    backgroundColor: '#FFF5F0',
    borderRadius: 25,
    padding: 15,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  buttonText: {
    color: '#000000',
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 1,
  },
  linkButton: {
    padding: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  disabledButton: {
    opacity: 0.6,
  },
});



