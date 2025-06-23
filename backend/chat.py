# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Autoriser toutes les origines pour le développement
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    message: int 

@app.post("/chat")
def chat(message: Message):
    user_input = message.message

    if  user_input == 1:
        return {"response": "Application de prise de notes vocales avec transcription, résumé, export PDF, et chat intégré."}
    elif user_input == 2:
        return {"response": " Comporte les notes indiquées comme publiques et une barre de recherche pour chercher une note à l’aide de son titre."}
    elif user_input == 3:
        return {"response": "Ajoutez vos notes, leur contenu et leur titre, ou bien annulez. Indiquez également si elles sont publiques ou privées."}
    elif user_input == 4:  
        return{"response":"le profil de l'utlisateur qui contient aussi ,choisi un nombre:/n 11)Privès /n 22)Publics/n 33)🗨️"} 
    elif  user_input == 11:
        return{"response":"Les notes de l’utilisateur peuvent être résumées, décrites, exportées en PDF , supprimées ou modifiées. Elles contiennent également la date d’ajout."}    
    elif user_input == 22:
        return{"response":"Les notes publiées par l’utilisateur. "}  
    elif user_input == 33:  
        return{"response":"Rechercher des amis à l’aide de leur nom, les contacter, créer des groupes, et partager des notes entre eux."}  
    else :
        return{"response":"ce choix n'exicte pas"} 