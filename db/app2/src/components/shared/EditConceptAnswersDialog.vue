<template>
    <q-dialog v-model="dialogVisible" persistent>
        <q-card style="min-width: 700px; max-width: 900px">
            <q-card-section class="row items-center">
                <div class="text-h6">Edit Concept Answers</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section>
                <!-- Concept Info -->
                <q-card flat bordered class="q-mb-md">
                    <q-card-section>
                        <div class="text-subtitle2">Concept Information</div>
                        <div class="text-body2">
                            <strong>Code:</strong> {{ concept.conceptCode }}<br>
                            <strong>Name:</strong> {{ concept.name }}<br>
                            <strong>Path:</strong> {{ concept.conceptPath }}
                        </div>
                    </q-card-section>
                </q-card>

                <!-- Add New Answer -->
                <q-expansion-item icon="add" label="Add New Answer" class="q-mb-md" v-model="showAddForm">
                    <q-card>
                        <q-card-section>
                            <q-form @submit.prevent="addAnswer" class="q-gutter-md">
                                <div class="row q-gutter-md">
                                    <div class="col">
                                        <q-input v-model="newAnswer.code" label="Answer Code" outlined dense
                                            :rules="[val => !!val || 'Answer code is required']"
                                            hint="e.g., LA6113-0" />
                                    </div>
                                    <div class="col">
                                        <q-input v-model="newAnswer.name" label="Answer Name" outlined dense
                                            :rules="[val => !!val || 'Answer name is required']"
                                            hint="e.g., Positive" />
                                    </div>
                                </div>

                                <q-input v-model="newAnswer.description" label="Description (optional)" outlined dense
                                    type="textarea" rows="2" />

                                <div class="row justify-end q-gutter-sm">
                                    <q-btn flat label="Cancel" @click="cancelAddAnswer" />
                                    <q-btn type="submit" label="Add Answer" color="primary"
                                        :disable="!newAnswer.code || !newAnswer.name" />
                                </div>
                            </q-form>
                        </q-card-section>
                    </q-card>
                </q-expansion-item>

                <!-- Existing Answers -->
                <div class="text-subtitle2 q-mb-sm">
                    Existing Answers ({{ answers.length }})
                </div>

                <q-table :rows="answers" :columns="columns" row-key="CONCEPT_CD" :loading="loading"
                    :pagination="{ rowsPerPage: 10 }" flat bordered>
                    <!-- Answer Code Column -->
                    <template v-slot:body-cell-CONCEPT_CD="props">
                        <q-td :props="props">
                            <div class="text-weight-medium">{{ props.value }}</div>
                        </q-td>
                    </template>

                    <!-- Answer Name Column -->
                    <template v-slot:body-cell-NAME_CHAR="props">
                        <q-td :props="props">
                            <div class="text-weight-medium">{{ props.value }}</div>
                            <div v-if="props.row.CONCEPT_BLOB" class="text-caption text-grey-6">
                                {{ truncateText(props.row.CONCEPT_BLOB, 60) }}
                            </div>
                        </q-td>
                    </template>

                    <!-- Actions Column -->
                    <template v-slot:body-cell-actions="props">
                        <q-td :props="props">
                            <q-btn flat round dense icon="edit" color="primary" @click="editAnswer(props.row)">
                                <q-tooltip>Edit Answer</q-tooltip>
                            </q-btn>
                            <q-btn flat round dense icon="delete" color="negative" @click="deleteAnswer(props.row)">
                                <q-tooltip>Delete Answer</q-tooltip>
                            </q-btn>
                        </q-td>
                    </template>
                </q-table>

                <div v-if="!loading && answers.length === 0" class="text-center text-grey-6 q-pa-lg">
                    No answers found. Add some answers above.
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat label="Close" color="primary" v-close-popup />
            </q-card-actions>
        </q-card>

        <!-- Edit Answer Dialog -->
        <q-dialog v-model="showEditDialog">
            <q-card style="min-width: 400px">
                <q-card-section>
                    <div class="text-h6">Edit Answer</div>
                </q-card-section>

                <q-card-section>
                    <q-form @submit.prevent="saveEditAnswer" class="q-gutter-md">
                        <q-input v-model="editingAnswer.CONCEPT_CD" label="Answer Code" outlined dense readonly />

                        <q-input v-model="editingAnswer.NAME_CHAR" label="Answer Name" outlined dense
                            :rules="[val => !!val || 'Answer name is required']" />

                        <q-input v-model="editingAnswer.CONCEPT_BLOB" label="Description" outlined dense type="textarea"
                            rows="3" />
                    </q-form>
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" @click="showEditDialog = false" />
                    <q-btn flat label="Save" color="primary" @click="saveEditAnswer"
                        :disable="!editingAnswer.NAME_CHAR" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'

const $q = useQuasar()
const dbStore = useDatabaseStore()

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    concept: {
        type: Object,
        required: true
    }
})

const emit = defineEmits(['update:modelValue'])

// State
const answers = ref([])
const loading = ref(false)
const showAddForm = ref(false)
const showEditDialog = ref(false)
const editingAnswer = ref({})

const newAnswer = ref({
    code: '',
    name: '',
    description: ''
})

const columns = [
    {
        name: 'CONCEPT_CD',
        label: 'Answer Code',
        align: 'left',
        field: 'CONCEPT_CD',
        sortable: true,
        style: 'width: 150px'
    },
    {
        name: 'NAME_CHAR',
        label: 'Answer Name',
        align: 'left',
        field: 'NAME_CHAR',
        sortable: true,
        style: 'min-width: 200px'
    },
    {
        name: 'actions',
        label: 'Actions',
        align: 'center',
        field: 'actions',
        sortable: false,
        style: 'width: 100px'
    }
]

const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => {
        emit('update:modelValue', value)
        if (!value) {
            // Reset state when dialog closes
            showAddForm.value = false
            showEditDialog.value = false
            resetNewAnswer()
        }
    }
})

// Methods
const loadAnswers = async () => {
    if (!props.concept.conceptPath || !props.concept.conceptCode) return

    loading.value = true
    try {
        const conceptRepo = dbStore.getRepository('concept')
        if (!conceptRepo) return

        const answerPath = `${props.concept.conceptPath}\\${props.concept.conceptCode}\\LA`
        const query = `
      SELECT * FROM CONCEPT_DIMENSION 
      WHERE CONCEPT_PATH LIKE '${answerPath}%'
      ORDER BY CONCEPT_CD
    `

        const result = await conceptRepo.connection.executeQuery(query)
        if (result.success && result.data) {
            answers.value = result.data
        } else {
            answers.value = []
        }
    } catch (error) {
        console.error('Failed to load answers:', error)
        $q.notify({
            type: 'negative',
            message: 'Failed to load answers'
        })
    } finally {
        loading.value = false
    }
}

const addAnswer = async () => {
    try {
        const conceptRepo = dbStore.getRepository('concept')
        if (!conceptRepo) return

        const now = new Date().toISOString()
        const answerPath = `${props.concept.conceptPath}\\${props.concept.conceptCode}\\LA\\${newAnswer.value.code}\\`

        const answerData = {
            CONCEPT_CD: `LA: ${newAnswer.value.code}`,
            NAME_CHAR: newAnswer.value.name,
            CONCEPT_PATH: answerPath,
            VALTYPE_CD: 'T', // Text type for answers
            SOURCESYSTEM_CD: 'LA', // Local Answer
            CONCEPT_BLOB: newAnswer.value.description || null,
            UPDATE_DATE: now,
            DOWNLOAD_DATE: now,
            IMPORT_DATE: now,
            UPLOAD_ID: 1
        }

        await conceptRepo.createConcept(answerData)

        $q.notify({
            type: 'positive',
            message: 'Answer added successfully'
        })

        resetNewAnswer()
        showAddForm.value = false
        await loadAnswers()
    } catch (error) {
        console.error('Failed to add answer:', error)
        $q.notify({
            type: 'negative',
            message: 'Failed to add answer'
        })
    }
}

const editAnswer = (answer) => {
    editingAnswer.value = { ...answer }
    showEditDialog.value = true
}

const saveEditAnswer = async () => {
    try {
        const conceptRepo = dbStore.getRepository('concept')
        if (!conceptRepo) return

        const updateData = {
            NAME_CHAR: editingAnswer.value.NAME_CHAR,
            CONCEPT_BLOB: editingAnswer.value.CONCEPT_BLOB,
            UPDATE_DATE: new Date().toISOString()
        }

        await conceptRepo.updateConcept(editingAnswer.value.CONCEPT_CD, updateData)

        $q.notify({
            type: 'positive',
            message: 'Answer updated successfully'
        })

        showEditDialog.value = false
        await loadAnswers()
    } catch (error) {
        console.error('Failed to update answer:', error)
        $q.notify({
            type: 'negative',
            message: 'Failed to update answer'
        })
    }
}

const deleteAnswer = (answer) => {
    $q.dialog({
        title: 'Confirm Delete',
        message: `Are you sure you want to delete answer "${answer.NAME_CHAR}" (${answer.CONCEPT_CD})? This action cannot be undone.`,
        cancel: true,
        persistent: true,
        color: 'negative'
    }).onOk(async () => {
        try {
            const conceptRepo = dbStore.getRepository('concept')
            if (!conceptRepo) return

            await conceptRepo.deleteConcept(answer.CONCEPT_CD)

            $q.notify({
                type: 'positive',
                message: 'Answer deleted successfully'
            })

            await loadAnswers()
        } catch (error) {
            console.error('Failed to delete answer:', error)
            $q.notify({
                type: 'negative',
                message: 'Failed to delete answer'
            })
        }
    })
}

const resetNewAnswer = () => {
    newAnswer.value = {
        code: '',
        name: '',
        description: ''
    }
}

const cancelAddAnswer = () => {
    resetNewAnswer()
    showAddForm.value = false
}

const truncateText = (text, maxLength) => {
    if (!text) return ''
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// Watch for concept changes
watch(() => props.concept, () => {
    if (props.modelValue) {
        loadAnswers()
    }
}, { deep: true })

watch(() => props.modelValue, (isVisible) => {
    if (isVisible) {
        loadAnswers()
    }
})

onMounted(() => {
    if (props.modelValue) {
        loadAnswers()
    }
})
</script>

<style lang="scss" scoped>
.q-table {
    .q-td {
        padding: 8px 16px;
    }
}
</style>
