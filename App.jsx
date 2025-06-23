import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import auth from '@react-native-firebase/auth';
import Login from "./components/Auth/Login";
import CreatAccont from "./components/Auth/CreatAccont"; // Utilisez le nom EXACT du fichier
import Home from "./components/Main/Home";
import Icon from 'react-native-vector-icons/Ionicons';
import Add from "./components/Main/Add";
import Explore from "./components/Main/Explore";
import Chat from "./components/Chat/Chat";
import ChatListe from "./components/Chat/ChatListe";
import AddToChat from "./components/Chat/AddToChat";
import Recorde from "./components/Main/Recorde";
import Chat2p from "./components/Chat/Chat2p";
import Toast from 'react-native-toast-message';
import ToNotes from "./components/Main/Notes";
import AfficherNotes from "./components/Main/AfficherNotes"
import CreateGroup from "./components/Chat/CreateGroupe";
import GroupChat from "./components/Chat/GroupeChat";
import GroupInfo from "./components/Chat/GroupeInfo";
import AddMember from "./components/Chat/AddMembre";
import Chatboot from './components/Main/chatboot';
import Resumer from './components/Main/resumer';
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNav (){
  return(
    <Tab.Navigator 
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
switch (route.name){
  case 'Home':
    iconName='home';
    break;
    case 'Add' :
      iconName='add-circle';
      break;
      case'Explore':
      iconName='person'
      break ;
}
        // if (route.name === 'Accueil') {
        //   iconName = focused ? 'home' : 'home-outline';
        // } else if (route.name === 'add') {
        //   iconName = 'Add-circle';
        // } else if (route.name === 'profile') {
        //   iconName = focused ? 'person' : 'person-outline';
        // }

        return <Icon name={iconName} size={size} color={color} />;
      },
      
      tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: '#1E90FF',
          height: 60,
          borderTopLeftRadius: 10,
         
          borderTopRightRadius: 10,
        },
        headerShown: false
      })}
      >
        <Tab.Screen name="Home" component={Home} options={{  tabBarIcon: ({ color, size }) => (
      <Icon name="home-outline" color={color} size={size} />
    ),}} />
        <Tab.Screen name="Add" component={Add} options={{ tabBarLabel: 'Ajouter'}} />
        <Tab.Screen name="Explore" component={Explore} options={{ tabBarLabel: 'profil'}} />
      </Tab.Navigator>
  )
}


export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(user => {
      setUser(user);
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, []);

  if (initializing) return null;

  return (
    <>
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? "Home" : "CreatAccont"}
        screenOptions={{
          headerStyle: { backgroundColor: '#1E90FF' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen
          name="CreatAccont"
          component={CreatAccont}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Login" component={Login} options={{ headerShown: false }}/>
        <Stack.Screen name="Home" component={TabNav} options={{ headerShown: false }} />
        <Stack.Screen name="Add" component={Add} options={{ headerShown: false }} />
        <Stack.Screen name="Explore" component={Explore} options={{ headerShown: false }} />
        <Stack.Screen name="Chat" component={Chat} options={{ headerShown: false }} />
        <Stack.Screen name="ChatListe" component={ChatListe} options={{ headerShown: false }} />
        <Stack.Screen name="AddToChat" component={AddToChat}  />
         <Stack.Screen name="Recorde" component={Recorde} options={{ headerShown: false }} />
         <Stack.Screen name="Chat2p" component={Chat2p} options={{ headerShown: false }} />
         <Stack.Screen name="Notes" component={ToNotes} options={{ headerShown: false }} />
         <Stack.Screen name="AfficherNotes" component={AfficherNotes} options={{ headerShown: false }} />
           <Stack.Screen name="CreateGroup" component={CreateGroup} options={{ title: 'Créer un groupe' ,headerShown: false}} />
           <Stack.Screen name="GroupChat" component={GroupChat} options={{ title: 'Créer un groupe' ,headerShown: false}} />
           <Stack.Screen name="GroupInfo" component={GroupInfo} options={{ title: 'Créer un groupe' ,headerShown: false}} />
           <Stack.Screen name="AddMember" component={AddMember}options={{ headerShown: false }} />
           <Stack.Screen name="Resumer" component={Resumer} options={{ headerShown: false }} />
           <Stack.Screen name="Chatboot" component={Chatboot} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
    <Toast />
    </>
  );
}