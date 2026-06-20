<div align="center">
  <img src="public/images/logo_readme.png" alt="TeacherAgent-ex Logo" height="200">

  <h1 align="center">TeacherAgent.ex (TeacherAgent-ex)</h1>

  <p align="center">
    <strong>TeacherAgent-ex</strong> è un software autore per la creazione e pubblicazione di risorse didattiche interattive, basato su licenza open source copyleft <strong>GNU AGPLv3</strong>.
    <br />
    <em>Si tratta di un fork sperimentale e indipendente derivato direttamente dal progetto originale <strong>eXeLearning</strong>.</em>
  </p>
</div>

---

## 📌 Cos'è TeacherAgent-ex?

**TeacherAgent-ex** (Teacher + AI Agent + eX) nasce come progetto sperimentale con l'obiettivo di integrare il supporto dell'intelligenza artificiale e degli agenti autonomi all'interno di eXeLearning. Questo consente di automatizzare la creazione di contenuti didattici, pagine strutturate, e soprattutto giochi o attività interattive in formato HTML5/JS/CSS direttamente dentro i blocchi di testo tradizionali (iDevices standard come *FreeText* / *Testo*).

Il progetto è stato sviluppato inizialmente per rispondere ad un'esigenza personale dell'autore e dei suoi colleghi docenti, per poi essere rilasciato pubblicamente e gratuitamente al fine di consentire a insegnanti, formatori e appassionati di utilizzarlo, modificarlo e distribuirlo liberamente nel pieno rispetto della filosofia open source.

---

## 🤖 I Due Livelli di Integrazione AI

Il sistema è strutturato su due modalità di funzionamento AI distinte e indipendenti:

### Livello 1: Assistente AI integrato nell'interfaccia (iDevice Assistant)
* **Descrizione**: Consente di invocare un assistente generativo direttamente nella barra laterale dell'applicazione per supportare la scrittura di codice sorgente HTML5/JS/CSS all'interno dei blocchi di testo.
* **Configurazione**: Funziona inserendo le proprie chiavi API personali direttamente nella configurazione dell'app.
* **Modello Testato**: Questa integrazione è stata ottimizzata e testata con successo con le API di **Mistral (Codestral)**, ideali per la generazione e la formattazione pulita di codice di gioco (non è ottimizzato per le API di Google Gemini in questa modalità diretta).

### Livello 2: Integrazione con l'agente autonomo locale (OpenCode Bridge)
* **Descrizione**: Consente ad un agente AI esterno ed autonomo di controllare l'applicazione e di generare percorsi didattici strutturati e complessi in totale autonomia con pochissimi click.
* **Funzionamento**: L'applicazione include un broker WebSocket integrato su porta locale. Se sulla stessa macchina è installato ed eseguito il software **OpenCode**, TeacherAgent-ex rileva automaticamente la connessione tramite un bridge WebSocket a circuito chiuso (`127.0.0.1`).
* **Modello Testato**: In questo caso, l'agente OpenCode locale si interfaccia efficacemente per orchestrare la creazione delle pagine e degli iDevice.

---

## ⚠️ Avvertenze sulla Sicurezza e Rischi importanti

> [!CAUTION]
> ### RISCHIO DI SICUREZZA NELL'ESECUZIONE DI AGENTI AI LOCALI
> L'esecuzione di un agente autonomo locale (come OpenCode o altri agenti CLI) a cui viene concesso l'accesso alla cartella `home` o alla directory di lavoro del proprio computer comporta **gravi rischi per la sicurezza dei dati**.
> 
> Un agente AI autonomo ha la capacità tecnica di:
> - Leggere, scrivere o eliminare qualsiasi file presente nelle directory a cui ha accesso.
> - Eseguire comandi shell sul sistema operativo locale.
> - Effettuare richieste di rete ed inviare dati.
> 
> Si raccomanda caldamente di eseguire l'applicazione e gli agenti in ambienti controllati o sandbox. L'utente assume la totale responsabilità in merito alla sicurezza dei propri dati ed all'uso degli agenti locali.

---

## ⚖️ Esclusione di Responsabilità (Disclaimer)

Il codice di questo progetto è stato **"vibe-codato"** (sviluppato in un flusso di programmazione assistita e prototipazione rapida) con l'ausilio di modelli di intelligenza artificiale avanzati (tra cui *GPT*, *Codex*, *Google Antigravity CLI* e *OpenCode*).

* Il software viene fornito **"così com'è" (AS IS)**, senza garanzie di alcun tipo, esplicite o implicite.
* Il creatore e i contributori del progetto **non si assumono alcuna responsabilità** per eventuali bug, crash, perdite di dati, falle di sicurezza o qualsiasi danno diretto o indiretto derivante dall'installazione o dall'uso di questo software o dei relativi agenti esterni.

---

## 🛠️ Come installare e configurare OpenCode e Gemini

Per sfruttare l'integrazione di **Livello 2** con l'agente autonomo locale **OpenCode**, segui questi passaggi:

### 1. Clonazione del repository di OpenCode
Apri un terminale sulla stessa macchina in cui è in esecuzione TeacherAgent-ex e clona il repository ufficiale di OpenCode:
```bash
git clone https://github.com/opencode-ai/opencode.git
cd opencode
```

### 2. Installazione delle dipendenze
Installa le dipendenze del runtime di OpenCode tramite npm (o il gestore di pacchetti indicato dal repository):
```bash
npm install -g opencode-cli
# oppure installazione locale
npm install
```

### 3. Configurazione delle variabili d'ambiente (Gemini)
Per consentire a OpenCode di utilizzare i modelli AI di Google (Gemini) durante l'orchestrazione, esporta la tua chiave API nel terminale:
```bash
export GEMINI_API_KEY="LA_TUA_CHIAVE_API_GEMINI"
```

### 4. Avvio dell'agente
Avvia l'agente abilitando l'esecuzione dei comandi locali per consentirgli di interfacciarsi con il bridge di TeacherAgent-ex:
```bash
opencode run --dangerously-skip-permissions
```
All'avvio, l'interfaccia grafica di TeacherAgent-ex intercetterà automaticamente la presenza dell'agente sulla porta WebSocket locale e si collegherà per consentire la generazione assistita.

---

## 🚀 Avvio Rapido di TeacherAgent-ex

### 1. Avvio dell'applicazione Desktop (Electron)
Se hai installato i lanciatori sul Desktop, fai doppio clic su **TeacherAgent-ex.desktop** o **eXeLearning.desktop**. 
In alternativa, da terminale esegui:
```bash
./teacheragent-ex-start.sh --desktop
```

### 2. Avvio Web locale (Bun)
Per sviluppare o utilizzare la versione server locale:
```bash
./teacheragent-ex-start.sh --web-local
```
L'editor sarà disponibile su `http://localhost:8080`.

---

## 📜 Note Legali e Rispetto dei Diritti originali

* **TeacherAgent-ex** è un fork indipendente a fini sperimentali e **non è affiliato, sponsorizzato o supportato** in alcun modo dal progetto ufficiale eXeLearning o dai suoi enti di coordinamento (Cedec-INTEF / Junta de Extremadura / Università di Auckland / eXe Project).
* Tutti i riferimenti sul copyright del codice originale, degli stili legacy e dei formati `.elp` / `.elpx` rimangono di proprietà dei rispettivi autori originari e sono preservati intatti all'interno del codice sorgente e della finestra informativa dell'applicazione.
* Il software è interamente rilasciato sotto la licenza copyleft **GNU Affero General Public License v3.0 (o successiva)**. Chiunque lo utilizzi e lo modifichi ha il diritto di accedere all'intero codice sorgente delle modifiche, garantendo la continuità open-source del lavoro svolto.

### Conformità delle librerie di terze parti:
Non sono state utilizzate librerie o SDK proprietari o chiusi. Tutte le dipendenze sono open source e compatibili con la licenza AGPLv3:
- **Elysia / Bun / Node.js** (Server e CLI): *MIT License*
- **Yjs & y-websocket** (Sincronizzazione in tempo reale): *MIT License*
- **Kysely & SQLite** (Database e persistenza locale): *MIT License / Public Domain*
- **Electron & Electron Builder** (Wrapper Desktop): *MIT License*
- **ws** (Broker WebSocket interno): *MIT License*
- **MathJax** (Rendering LaTeX): *Apache License 2.0*
- **Mermaid** (Rendering diagrammi): *MIT License*
