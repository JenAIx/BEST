<template>
    <q-page data-cy="page_finished" class="flex flex-center column">
        <div class="text-h6 text-center q-pa-xl">
            VIELEN DANK, dass Sie an dem Fragebogen teilgenommen haben.
            <q-icon class="cursor-pointer" color="grey-8" name="list_alt" @click="$router.push({name: 'storage'})"><q-tooltip>Zu den gespeicherten Fragebogendaten wechseln</q-tooltip></q-icon>
        </div>

        <div v-if="mainStore.EXPORT_DATA.length>0">
            <q-card class="my-form" v-if="mainStore.EXPORT_DATA[0].email">
                <q-card-section class="text-center text-h6">
                    Versenden der Daten an:
                    <br>
                    {{mainStore.EXPORT_DATA[0].email}}
                </q-card-section>

                <q-card-section class="text-caption">
                    Die Daten werden komplett verschlüsselt versendet und können nur vom Ersteller des Fragebogens entschlüsselt werden.
                </q-card-section>

                <q-separator inset />

                <q-card-actions>    
                    <q-btn no-caps class="fit" color="primary" @click="sendMail()">
                        Ich möchte die Fragebogendaten versenden ...
                    </q-btn>    
                </q-card-actions>
            </q-card>

        </div>

        <BACKBUTTON />
    </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import BACKBUTTON from 'src/components/BackButton.vue'

export default {
    name: 'FinishedQuest',
    setup() {
        return { mainStore: useMainStore() }
    },

    data() {
        return {}
    },

    mounted() {
        // console.log(this.mainStore.EXPORT_DATA)
    },
    
    components: {BACKBUTTON},

    methods: {
        sendMail() {
            // SEND MAIL
            this.mainStore.mail_exported_data()
            .then(() => this.$q.notify({message: this.$t('quest.export_success'),color: 'green'}))
        }
    }
}



</script>