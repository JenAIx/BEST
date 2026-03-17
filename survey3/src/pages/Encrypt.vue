<template>
  <q-page data-cy="page_settigns">
    <div class="column items-center q-pt-xl q-pb-lg q-px-md">

      <!-- TITLE -->
      <div class="col text-center q-mb-lg" style="max-width: 500px">
        <div class="text-h6 q-mb-sm">Nachrichten ver- und entschlüsseln</div>
        <div class="text-caption text-grey-7">
          <p><strong>Motivation:</strong> RSA mit priv/pub Key nur für kleine Nachrichten sinnvoll</p>
          <p><strong>Prinzip:</strong> 1. Erzeuge einen AES Key (128bit) 2. Verschlüssele Nachricht mit AES Key
            3. Verschlüssele AES Key mit RSA-public Key 4. Zum Entschlüsseln muss der AES-Key mit RSA-priv
            entschlüsselt werden; dann kann mit dem AES Key die Nachricht entschlüsselt werden</p>
        </div>
      </div>

      <!-- Encrypt Section -->
      <q-card flat bordered class="col q-mb-md" style="max-width: 500px; width: 100%">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8 q-mb-sm">Verschlüsseln</div>
          <q-input v-model="data" label="Unverschlüsselte Nachricht" outlined dense />
        </q-card-section>
        <q-card-actions align="center">
          <q-btn flat color="primary" icon="lock" label="Encrypt" @click="do_encrypt" />
        </q-card-actions>
      </q-card>

      <!-- Encrypted Output -->
      <q-card flat bordered class="col q-mb-md" style="max-width: 500px; width: 100%">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8 q-mb-sm">Verschlüsselte Daten</div>
          <q-input v-model="encrypted_data" outlined dense label="Verschlüsselte Nachricht (AES 128bit)" class="q-mb-sm" />
          <q-input v-model="encrypted_key" outlined dense label="Verschlüsselter AES Key (RSA publicKey)" />
        </q-card-section>
        <q-card-actions align="center">
          <q-btn flat color="primary" icon="lock_open" label="Decrypt" @click="do_decrypt" />
        </q-card-actions>
      </q-card>

      <!-- Decrypted Output -->
      <q-card flat bordered class="col q-mb-md" style="max-width: 500px; width: 100%">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8 q-mb-sm">Entschlüsselte Nachricht</div>
          <q-input v-model="decrypted_text" outlined dense readonly hint="Entschlüsselt mit RSA-priv AES Key" />
        </q-card-section>
      </q-card>

      <!-- File Import -->
      <q-card flat bordered class="col" style="max-width: 500px; width: 100%">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8 q-mb-sm">Datei importieren</div>
          <q-file v-model="file" label="Datei auswählen" outlined dense />
        </q-card-section>
        <q-card-actions v-if="file !== null" align="center">
          <q-btn flat color="primary" icon="upload_file" label="Load" @click="loadFile()" />
        </q-card-actions>
      </q-card>

    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON :go_back="true" />

  </q-page>
</template>

<script>
  import { useMainStore } from 'src/stores/main'
  import {encrypt, decrypt} from 'src/tools/hhash'
  import BACKBUTTON from 'src/components/BackButton.vue'

  export default {
    components: {BACKBUTTON},
    setup() {
      return { mainStore: useMainStore() }
    },
    data() {
      return {
        file: null,
        data: 'some text ...',
        encrypted_data: '',
        encrypted_key: '',
        decrypted_text: ''
      }
    },
    computed: {
      keyPair() {
        if (this.mainStore.SETTINGS.user_keyPair === undefined) this.mainStore.SETTINGS._USER.create()
        return this.mainStore.SETTINGS.user_keyPair
      }
    },
    methods: {
      do_encrypt() {
        const enc = encrypt(this.data, this.keyPair.publicKey)
        this.encrypted_key = enc.encrypted_key
        this.encrypted_data = enc.encrypted_data
      },
      do_decrypt() {
        this.decrypted_text = decrypt({encrypted_data: this.encrypted_data, encrypted_key: this.encrypted_key}, this.keyPair.privateKey)
      },
      loadFile() {
        const reader = new FileReader();
        reader.onload = (e) => {
          let txt = e.target.result
          let json = JSON.parse(txt)
          this.decrypted_text = decrypt({encrypted_data: json.encrypted_data, encrypted_key: json.encrypted_key}, this.keyPair.privateKey)
        }
        reader.readAsText(this.file);

      }
    }
  }

</script>
