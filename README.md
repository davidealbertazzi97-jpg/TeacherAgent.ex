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

Il progetto è stato sviluppato inizialmente per rispondere ad ad una mia personale esigenza e ad un'esigenza che vedevo nei miei colleghi docenti, per poi decidere di renderlo pubblico gratuitamente nel rispetto delle licenze in modo che chiunque (insegnanti, formatori o semplici appassionati) possa utilizzarlo, modificarlo e distribuirlo liberamente.

---

## 🤖 I Due Livelli di Integrazione AI e Privacy Policy

Il sistema è strutturato su due modalità di funzionamento AI distinte e indipendenti, con differenti implicazioni per la privacy:

### Livello 1: Assistente AI integrato nell'interfaccia (iDevice Assistant)
* **Descrizione**: Consente di invocare un assistente generativo direttamente nella barra laterale dell'applicazione per supportare la scrittura di codice sorgente HTML5/JS/CSS all'interno dei blocchi di testo.
* **Configurazione**: Funziona inserendo le proprie chiavi API personali direttamente nella configurazione dell'app.
* **Modello Testato**: Questa integrazione è stata ottimizzata e testata con successo esclusivamente con le API di **Mistral (Codestral)**. 
* **UI & Provider**: I pulsanti per gli altri provider di terze parti nella schermata delle impostazioni sono attualmente contrassegnati come **Work in Progress (Lavori in corso)**.
* **Privacy Policy**: Nel Livello 1, il trattamento dei dati e la privacy dipendono interamente dal provider di cui si inserisce la chiave API personale (es. Mistral). I dati inseriti nel prompt dell'assistente saranno inviati al rispettivo provider secondo i suoi termini di servizio.

### Livello 2: Integrazione con l'agente autonomo locale (OpenCode Bridge)
* **Descrizione**: Consente ad un agente AI esterno ed autonomo di controllare l'applicazione e di generare percorsi didattici strutturati e complessi in totale autonomia con pochissimi click.
* **Come funziona**: Quando l'utente scarica ed esegue **OpenCode** sul proprio computer, TeacherAgent-ex ne rileva la presenza in locale. Selezionando la voce "Agent" nella barra laterale del programma, l'app mostrerà gli agenti installati e disponibili sul computer. Cliccando sul pulsante **"Connect" (Connetti)**, l'app stabilirà una connessione tramite un bridge WebSocket locale.
  - *Connessione su altre macchine*: Di default, per motivi di sicurezza, il WebSocket bridge si lega a `127.0.0.1`. Se si desidera connettere OpenCode da un altro computer presente sulla stessa rete locale, basta avviare l'applicazione impostando la variabile d'ambiente `EXE_AGENT_BROKER_HOST=0.0.0.0` (o l'IP LAN del computer che esegue l'app).
    * Su Linux/macOS: `EXE_AGENT_BROKER_HOST=0.0.0.0 ./teacheragent-ex-start.sh --desktop`
    * Su Windows (PowerShell): `$env:EXE_AGENT_BROKER_HOST="0.0.0.0"; bun run electron`
* **Modello Consigliato (Zen Cloud)**: L'integrazione è stata ottimizzata e testata per funzionare con i **modelli "Zen" inclusi nel piano gratuito di OpenCode**.
  - *Nota Importante*: **I modelli Zen non sono locali**; essi girano in cloud sui server di OpenCode. Di conseguenza, dopo l'installazione di OpenCode è necessario effettuare l'autenticazione del proprio account OpenCode.
  - *Modelli Locali*: Se l'utente lo desidera, OpenCode supporta la connessione a modelli locali (es. tramite Ollama), sebbene questa modalità non sia stata testata dall'autore per questo specifico fork.
* **Privacy Policy**: L'autore ha testato e ottimizzato solo l'agente OpenCode. Quando si utilizza questo agente, il trattamento dei dati è soggetto alla **Privacy Policy di OpenCode**. Per qualsiasi altro agente di coding esterno che l'utente decidesse di connettere, la privacy dipenderà esclusivamente dalle politiche di quell'agente.

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

Il codice di questo progetto è stato **"vibe-codato"** (sviluppato in un flusso di programmazione assistita e prototipazione rapida) con l'ausilio di modelli di intelligenza artificiale avanzati e strumenti agentici (tra cui *GPT Codex*, *Google Antigravity CLI* e *OpenCode*).

* Il software viene fornito **"così com'è" (AS IS)**, senza garanzie di alcun tipo, esplicite o implicite.
* Il creatore e i contributori del progetto **non si assumono alcuna responsabilità** per eventuali bug, crash, perdite di dati, falle di sicurezza o qualsiasi danno diretto o indiretto derivante dall'installazione o dall'uso di questo software o dei relativi agenti esterni.

---

## 🛠️ Come installare e configurare OpenCode

Per sfruttare l'integrazione di **Livello 2** con l'agente autonomo locale **OpenCode** utilizzando i suoi modelli Zen (gratuiti o a pagamento offerti da OpenCode), segui questi passaggi per installare l'agente ed effettuare l'autenticazione:

### 1. Installazione di OpenCode CLI

#### 🐧 Linux & 🍎 macOS
Apri il terminale ed esegui il comando ufficiale di installazione:
```bash
curl -fsSL https://opencode.ai/install | bash
```
In alternativa, se hai Node.js installato, puoi usare `npm`:
```bash
npm install -g opencode-ai
```
Oppure tramite Homebrew (macOS/Linux):
```bash
brew install opencode-ai/tap/opencode
```

#### 💻 Windows
Il metodo consigliato per Windows è utilizzare **WSL (Windows Subsystem for Linux)** eseguendo all'interno del terminale WSL:
```bash
curl -fsSL https://opencode.ai/install | bash
```
Se invece preferisci un'installazione nativa per Windows, puoi usare `npm` (richiede Node.js):
```bash
npm install -g opencode-ai
```
Oppure tramite Scoop:
```bash
scoop install opencode
```

### 2. Autenticazione dell'account OpenCode
Per utilizzare i modelli Zen inclusi nel piano di OpenCode, effettua l'autenticazione iniziale eseguendo:
```bash
opencode auth login
```
Segui le istruzioni a schermo per completare il login e attivare i modelli Zen cloud (o il tuo abbonamento).

### 3. Connessione a TeacherAgent-ex
Una volta installato ed autenticato l'agente:
1. Avvia l'applicazione desktop **TeacherAgent-ex**.
2. Seleziona la voce **"Agent"** nella barra laterale sinistra dell'applicazione.
3. L'applicazione rileverà automaticamente la presenza dell'agente OpenCode locale. Clicca sul pulsante **"Connect" (Connetti)** per stabilire la connessione e iniziare ad automatizzare la creazione di contenuti!

---

## 🚀 Download e Installazione di TeacherAgent-ex (Cross-Platform)

L'applicazione è pienamente compatibile e installabile su **Linux, Windows e macOS**.

### 📦 Opzione 1: Installatori Precompilati (Consigliato per gli utenti)
I pacchetti precompilati pronti all'uso sono disponibili nella sezione **[Releases](https://github.com/davidealbertazzi97-jpg/TeacherAgent.ex/releases)** di questa repository:

*   **💻 Windows (ZIP portatile)**:
    *   Scarica il file `teacheragent-ex-windows-portable.zip` (presente anche localmente nella cartella `release/` dopo la compilazione).
    *   Estrai il file ZIP in una cartella a tua scelta.
    *   Fai doppio clic su `TeacherAgent-ex.exe` all'interno della cartella estratta per avviare l'applicazione.
*   **🍎 macOS (ZIP / DMG)**:
    *   Scarica il file `TeacherAgent-ex-0.0.0-alpha-mac.zip` o l'immagine `.dmg`.
    *   Estrai il file ZIP (o apri il file `.dmg`) e trascina `TeacherAgent-ex.app` all'interno della cartella **Applicazioni** (Applications) per l'installazione con un click.
*   **🐧 Ubuntu / Debian (DEB)**:
    *   Scarica il pacchetto `teacheragent-ex_0.0.0-alpha_amd64.deb` (presente anche in `release/`).
    *   Fai doppio clic sul file per aprirlo nel Software Center di Ubuntu e installarlo con un click tramite interfaccia grafica.
    *   In alternativa, installalo da terminale con:
        ```bash
        sudo dpkg -i teacheragent-ex_0.0.0-alpha_amd64.deb
        sudo apt-get install -f
        ```

---

### 🛠️ Opzione 2: Installazione da sorgente (Sviluppatori)
Se desideri avviare l'applicazione in modalità sviluppo o compilarla autonomamente, segui le istruzioni relative al tuo sistema operativo:

### 🐧 Installazione su Linux (Ubuntu/Debian/Mint/ecc.)
**Prerequisiti**: Assicurati di aver installato [Bun](https://bun.sh/) e [Node.js](https://nodejs.org/) sul tuo sistema.
Apri il terminale ed esegui i seguenti comandi:
```bash
# Clona il repository
git clone https://github.com/davidealbertazzi97-jpg/TeacherAgent.ex.git
cd TeacherAgent.ex

# Installa le dipendenze di progetto
bun install

# Avvio dell'applicazione desktop tramite script
./teacheragent-ex-start.sh --desktop
```

---

### 💻 Installazione su Windows
**Prerequisiti**: Assicurati di aver installato [Bun](https://bun.sh/) e [Node.js](https://nodejs.org/) sul tuo sistema.
Apri il Prompt dei comandi o PowerShell ed esegui:
```powershell
# Clona il repository
git clone https://github.com/davidealbertazzi97-jpg/TeacherAgent.ex.git
cd TeacherAgent.ex

# Installa le dipendenze di progetto
bun install

# Prepara e compila gli asset per Electron
bun run package:prepare

# Avvia l'applicazione desktop
bun run electron
```

---

### 🍎 Installazione su macOS
**Prerequisiti**: Assicurati di aver installato [Bun](https://bun.sh/) e [Node.js](https://nodejs.org/) sul tuo sistema.
Apri il Terminale ed esegui:
```bash
# Clona il repository
git clone https://github.com/davidealbertazzi97-jpg/TeacherAgent.ex.git
cd TeacherAgent.ex

# Installa le dipendenze di progetto
bun install

# Prepara e compila gli asset per Electron
bun run package:prepare

# Avvia l'applicazione desktop
bun run electron
```

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
