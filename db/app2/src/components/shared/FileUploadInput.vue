<template>
    <div class="file-upload-input">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
            File Upload: <span class="text-negative">*</span>
            <span class="text-caption text-grey-6">(Required)</span>
        </div>

        <!-- File Drop Zone -->
        <div 
            class="file-drop-zone"
            :class="{ 'drag-over': isDragOver, 'has-file': selectedFile }"
            @drop="handleDrop"
            @dragover.prevent="handleDragOver"
            @dragleave="handleDragLeave"
            @click="triggerFileInput"
        >
            <!-- File Input (Hidden) -->
            <input
                ref="fileInput"
                type="file"
                :accept="acceptedTypes"
                @change="handleFileSelect"
                style="display: none;"
            />

            <!-- Drop Zone Content -->
            <div v-if="!selectedFile" class="drop-zone-content">
                <q-icon name="cloud_upload" size="48px" color="grey-5" />
                <div class="text-h6 text-grey-6 q-mt-sm">Drop file here or click to browse</div>
                <div class="text-caption text-grey-5 q-mt-xs">
                    Supported: {{ supportedFormats.join(', ') }}
                </div>
                <div class="text-caption text-grey-5">
                    Max size: {{ maxSizeMB }}MB
                </div>
            </div>

            <!-- Selected File Display -->
            <div v-else class="selected-file-display">
                <div class="row items-center q-gutter-md">
                    <div class="col-auto">
                        <q-icon :name="getFileIcon(selectedFile.type)" size="32px" :color="getFileColor(selectedFile.type)" />
                    </div>
                    <div class="col">
                        <div class="text-weight-medium">{{ selectedFile.name }}</div>
                        <div class="text-caption text-grey-6">
                            {{ formatFileSize(selectedFile.size) }} • {{ getFileExtension(selectedFile.name) }}
                        </div>
                    </div>
                    <div class="col-auto">
                        <q-btn flat round dense icon="close" color="negative" size="sm" @click.stop="clearFile">
                            <q-tooltip>Remove file</q-tooltip>
                        </q-btn>
                    </div>
                </div>

                <!-- File Preview (for images) -->
                <div v-if="isImage(selectedFile.type) && previewUrl" class="file-preview q-mt-md">
                    <img :src="previewUrl" alt="File preview" class="preview-image" />
                </div>
            </div>
        </div>

        <!-- File Validation Errors -->
        <div v-if="validationError" class="text-negative text-caption q-mt-sm">
            <q-icon name="error" class="q-mr-xs" />
            {{ validationError }}
        </div>

        <!-- File Info JSON Display (for debugging) -->
        <div v-if="selectedFile && showDebugInfo" class="file-info-debug q-mt-sm">
            <q-expansion-item label="File Info (Debug)" dense>
                <div class="text-caption q-pa-sm bg-grey-1">
                    <pre>{{ fileInfoJson }}</pre>
                </div>
            </q-expansion-item>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
    modelValue: {
        type: Object,
        default: null
    },
    maxSizeMB: {
        type: Number,
        default: 10
    },
    acceptedTypes: {
        type: String,
        default: '.txt,.png,.gif,.jpg,.jpeg,.pdf'
    },
    showDebugInfo: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'fileSelected', 'fileCleared'])

const $q = useQuasar()

// Reactive state
const fileInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref(null)
const isDragOver = ref(false)
const validationError = ref('')

// Computed properties
const supportedFormats = computed(() => {
    return props.acceptedTypes.split(',').map(type => type.trim().replace('.', '').toUpperCase())
})

const fileInfoJson = computed(() => {
    if (!selectedFile.value) return null
    
    return JSON.stringify({
        filename: selectedFile.value.name,
        size: selectedFile.value.size,
        ext: getFileExtension(selectedFile.value.name)
    }, null, 2)
})

// Methods
const triggerFileInput = () => {
    if (fileInput.value) {
        fileInput.value.click()
    }
}

const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
        processFile(file)
    }
}

const handleDrop = (event) => {
    event.preventDefault()
    isDragOver.value = false
    
    const files = event.dataTransfer.files
    if (files.length > 0) {
        processFile(files[0])
    }
}

const handleDragOver = (event) => {
    event.preventDefault()
    isDragOver.value = true
}

const handleDragLeave = () => {
    isDragOver.value = false
}

const processFile = async (file) => {
    validationError.value = ''
    
    // Validate file type
    const extension = getFileExtension(file.name).toLowerCase()
    const allowedExtensions = props.acceptedTypes.split(',').map(type => type.trim().replace('.', ''))
    
    if (!allowedExtensions.includes(extension)) {
        validationError.value = `File type .${extension} is not supported. Allowed types: ${allowedExtensions.join(', ')}`
        return
    }
    
    // Validate file size
    const maxSizeBytes = props.maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
        validationError.value = `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${props.maxSizeMB}MB)`
        return
    }
    
    // Set selected file
    selectedFile.value = file
    
    // Create preview for images
    if (isImage(file.type)) {
        createImagePreview(file)
    } else {
        previewUrl.value = null
    }
    
    // Convert file to blob and create file info
    try {
        const arrayBuffer = await file.arrayBuffer()
        const blob = new Uint8Array(arrayBuffer)
        
        const fileData = {
            fileInfo: {
                filename: file.name,
                size: file.size,
                ext: extension
            },
            blob: blob,
            originalFile: file
        }
        
        emit('update:modelValue', fileData)
        emit('fileSelected', fileData)
        
        $q.notify({
            type: 'positive',
            message: `File "${file.name}" selected successfully`,
            position: 'top',
            timeout: 2000
        })
    } catch (error) {
        console.error('Error processing file:', error)
        validationError.value = 'Error processing file. Please try again.'
        
        $q.notify({
            type: 'negative',
            message: 'Failed to process file',
            position: 'top'
        })
    }
}

const createImagePreview = (file) => {
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
    }
    
    previewUrl.value = URL.createObjectURL(file)
}

const clearFile = () => {
    selectedFile.value = null
    validationError.value = ''
    
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
        previewUrl.value = null
    }
    
    if (fileInput.value) {
        fileInput.value.value = ''
    }
    
    emit('update:modelValue', null)
    emit('fileCleared')
    
    $q.notify({
        type: 'info',
        message: 'File removed',
        position: 'top',
        timeout: 1500
    })
}

const getFileExtension = (filename) => {
    return filename.split('.').pop() || ''
}

const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType === 'application/pdf') return 'picture_as_pdf'
    if (mimeType.startsWith('text/')) return 'description'
    return 'insert_drive_file'
}

const getFileColor = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'green'
    if (mimeType === 'application/pdf') return 'red'
    if (mimeType.startsWith('text/')) return 'blue'
    return 'grey'
}

const isImage = (mimeType) => {
    return mimeType.startsWith('image/')
}

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
    if (!newValue) {
        selectedFile.value = null
        if (previewUrl.value) {
            URL.revokeObjectURL(previewUrl.value)
            previewUrl.value = null
        }
    }
})

// Cleanup on unmount
onUnmounted(() => {
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
    }
})
</script>

<style lang="scss" scoped>
.file-upload-input {
    .file-drop-zone {
        border: 2px dashed #e0e0e0;
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        background: #fafafa;
        min-height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        &:hover {
            border-color: #1976d2;
            background: #f3f8ff;
        }
        
        &.drag-over {
            border-color: #1976d2;
            background: #e3f2fd;
            transform: scale(1.02);
        }
        
        &.has-file {
            border-color: #4caf50;
            background: #f1f8e9;
            text-align: left;
            padding: 16px;
        }
    }
    
    .drop-zone-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    
    .selected-file-display {
        width: 100%;
        
        .preview-image {
            max-width: 200px;
            max-height: 150px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
            object-fit: cover;
        }
    }
    
    .file-info-debug {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        
        pre {
            margin: 0;
            font-size: 11px;
            line-height: 1.4;
        }
    }
}

@media (max-width: 480px) {
    .file-upload-input {
        .file-drop-zone {
            padding: 16px;
            min-height: 100px;
        }
        
        .selected-file-display {
            .preview-image {
                max-width: 150px;
                max-height: 100px;
            }
        }
    }
}
</style>
