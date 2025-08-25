<template>
    <q-dialog v-model="showDialog" persistent>
        <q-card style="min-width: 500px; max-width: 800px; max-height: 90vh;">
            <q-card-section class="row items-center q-pb-none">
                <div class="text-h6 text-primary">
                    <q-icon name="attachment" class="q-mr-sm" />
                    File Preview
                </div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section v-if="fileInfo">
                <div class="file-preview-dialog-content">
                    <!-- File Header -->
                    <div class="file-preview-header q-mb-md">
                        <div class="row items-center q-gutter-md">
                            <q-icon :name="getFileIcon(fileInfo.filename)" :color="getFileColor(fileInfo.filename)"
                                size="48px" />
                            <div class="file-info">
                                <div class="text-h6">{{ fileInfo.filename }}</div>
                                <div class="text-body2 text-grey-6">
                                    Size: {{ formatFileSize(fileInfo.size) }}
                                </div>
                                <div class="text-body2 text-grey-6">
                                    Type: {{ fileInfo.ext.toUpperCase() }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- File Preview Content -->
                    <div class="file-preview-content q-mb-md" style="max-height: 400px; overflow: auto;">
                        <!-- Image Preview -->
                        <div v-if="isImageFile(fileInfo.filename)" class="image-preview">
                            <div class="text-subtitle2 text-grey-7 q-mb-sm">Preview:</div>
                            <div v-if="imagePreviewUrl" class="image-container">
                                <img :src="imagePreviewUrl" :alt="fileInfo.filename" class="preview-image"
                                    @load="onImageLoad" @error="onImageError" />
                            </div>
                            <div v-else-if="isLoadingPreview" class="preview-loading">
                                <q-spinner color="primary" size="32px" />
                                <div class="text-body2 text-grey-6 q-mt-sm">Loading image preview...</div>
                            </div>
                            <div v-else-if="previewError" class="preview-error">
                                <q-icon name="error" size="32px" color="negative" />
                                <div class="text-body2 text-negative q-mt-sm">{{ previewError }}</div>
                            </div>
                        </div>

                        <!-- Text Preview -->
                        <div v-else-if="isTextFile(fileInfo.filename)" class="text-preview">
                            <div class="text-subtitle2 text-grey-7 q-mb-sm">Preview:</div>
                            <div v-if="textContent" class="text-container">
                                <pre class="text-content">{{ textContent }}</pre>
                            </div>
                            <div v-else-if="isLoadingPreview" class="preview-loading">
                                <q-spinner color="primary" size="32px" />
                                <div class="text-body2 text-grey-6 q-mt-sm">Loading text preview...</div>
                            </div>
                            <div v-else-if="previewError" class="preview-error">
                                <q-icon name="error" size="32px" color="negative" />
                                <div class="text-body2 text-negative q-mt-sm">{{ previewError }}</div>
                            </div>
                        </div>

                        <!-- PDF Preview -->
                        <div v-else-if="isPdfFile(fileInfo.filename)" class="pdf-preview">
                            <div class="text-subtitle2 text-grey-7 q-mb-sm">Preview:</div>
                            <div v-if="pdfPreviewUrl" class="pdf-container">
                                <iframe :src="pdfPreviewUrl" class="pdf-iframe" @load="onPdfLoad"
                                    @error="onPdfError"></iframe>
                            </div>
                            <div v-else-if="isLoadingPreview" class="preview-loading">
                                <q-spinner color="primary" size="32px" />
                                <div class="text-body2 text-grey-6 q-mt-sm">Loading PDF preview...</div>
                            </div>
                            <div v-else-if="previewError" class="preview-error">
                                <q-icon name="error" size="32px" color="negative" />
                                <div class="text-body2 text-negative q-mt-sm">{{ previewError }}</div>
                            </div>
                        </div>

                        <!-- Unsupported File Type -->
                        <div v-else class="unsupported-preview">
                            <div class="text-subtitle2 text-grey-7 q-mb-sm">Preview:</div>
                            <div class="preview-placeholder">
                                <q-icon name="insert_drive_file" size="64px" color="grey-5" />
                                <div class="text-body2 text-grey-6 q-mt-sm">
                                    Preview not available for this file type
                                </div>
                                <div class="text-caption text-grey-5">
                                    Supported formats: PNG, JPG, GIF, TXT, PDF
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- File Metadata -->
                    <div class="file-metadata q-mb-md">
                        <div class="text-subtitle2 text-grey-7 q-mb-sm">File Information:</div>
                        <div class="row q-gutter-md">
                            <div class="col">
                                <q-chip outline color="primary" size="sm">
                                    <q-icon name="event" class="q-mr-xs" />
                                    Uploaded: {{ formatDate(uploadDate) }}
                                </q-chip>
                            </div>
                            <div class="col">
                                <q-chip outline color="secondary" size="sm">
                                    <q-icon name="science" class="q-mr-xs" />
                                    {{ conceptName }}
                                </q-chip>
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="file-actions">
                        <q-btn color="primary" icon="download" label="Download File" :loading="isDownloading"
                            @click="downloadFile" class="full-width" />
                    </div>
                </div>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    observationId: {
        type: [String, Number],
        required: true
    },
    fileInfo: {
        type: Object,
        required: true
    },
    conceptName: {
        type: String,
        default: 'Unknown Concept'
    },
    uploadDate: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const dbStore = useDatabaseStore()
const logger = useLoggingStore().createLogger('FilePreviewDialog')

// Reactive state
const isDownloading = ref(false)
const isLoadingPreview = ref(false)
const previewError = ref('')
const imagePreviewUrl = ref(null)
const textContent = ref('')
const pdfPreviewUrl = ref(null)

// Computed properties
const showDialog = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Helper methods
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString()
}

const getFileIcon = (filename) => {
    if (!filename) return 'insert_drive_file'

    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'pdf': return 'picture_as_pdf'
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif': return 'image'
        case 'txt': return 'description'
        default: return 'insert_drive_file'
    }
}

const getFileColor = (filename) => {
    if (!filename) return 'grey'

    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'pdf': return 'red'
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif': return 'green'
        case 'txt': return 'blue'
        default: return 'grey'
    }
}

const isImageFile = (filename) => {
    if (!filename) return false
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['png', 'jpg', 'jpeg', 'gif'].includes(ext)
}

const isTextFile = (filename) => {
    if (!filename) return false
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['txt'].includes(ext)
}

const isPdfFile = (filename) => {
    if (!filename) return false
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['pdf'].includes(ext)
}

// Preview loading methods
const loadFilePreview = async () => {
    if (!props.observationId || !props.fileInfo) return

    try {
        isLoadingPreview.value = true
        previewError.value = ''

        logger.info('Loading file preview', {
            observationId: props.observationId,
            filename: props.fileInfo.filename,
            type: props.fileInfo.ext
        })

        const result = await dbStore.downloadRawData(props.observationId)

        if (result.success) {
            const blob = new Blob([result.blob], {
                type: result.fileInfo.mimeType || 'application/octet-stream'
            })

            if (isImageFile(props.fileInfo.filename)) {
                imagePreviewUrl.value = URL.createObjectURL(blob)
            } else if (isTextFile(props.fileInfo.filename)) {
                const text = await blob.text()
                textContent.value = text.length > 10000 ? text.substring(0, 10000) + '\n\n... (file truncated for preview)' : text
            } else if (isPdfFile(props.fileInfo.filename)) {
                pdfPreviewUrl.value = URL.createObjectURL(blob)
            }

            logger.success('File preview loaded successfully', {
                filename: props.fileInfo.filename,
                size: formatFileSize(props.fileInfo.size)
            })
        } else {
            throw new Error('Failed to load file data')
        }
    } catch (error) {
        logger.error('Failed to load file preview', error, {
            observationId: props.observationId,
            filename: props.fileInfo.filename
        })
        previewError.value = `Failed to load preview: ${error.message}`
    } finally {
        isLoadingPreview.value = false
    }
}

// Event handlers
const onImageLoad = () => {
    logger.debug('Image preview loaded successfully')
}

const onImageError = () => {
    previewError.value = 'Failed to load image preview'
    logger.error('Image preview failed to load')
}

const onPdfLoad = () => {
    logger.debug('PDF preview loaded successfully')
}

const onPdfError = () => {
    previewError.value = 'Failed to load PDF preview'
    logger.error('PDF preview failed to load')
}

const downloadFile = async () => {
    if (isDownloading.value) return

    try {
        isDownloading.value = true

        logger.info('Downloading file from preview dialog', {
            observationId: props.observationId,
            filename: props.fileInfo.filename
        })

        const result = await dbStore.downloadRawData(props.observationId)

        if (result.success) {
            // Create blob and download
            const blob = new Blob([result.blob], {
                type: result.fileInfo.mimeType || 'application/octet-stream'
            })

            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = result.fileInfo.filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            $q.notify({
                type: 'positive',
                message: `File "${result.fileInfo.filename}" downloaded successfully`,
                position: 'top',
                timeout: 3000
            })

            logger.success('File downloaded successfully from preview', {
                filename: result.fileInfo.filename,
                size: formatFileSize(result.fileInfo.size)
            })
        } else {
            throw new Error('Download failed')
        }
    } catch (error) {
        logger.error('File download failed from preview', error, {
            observationId: props.observationId
        })

        $q.notify({
            type: 'negative',
            message: `Failed to download file: ${error.message}`,
            position: 'top',
            timeout: 5000
        })
    } finally {
        isDownloading.value = false
    }
}

// Cleanup URLs on unmount
const cleanupUrls = () => {
    if (imagePreviewUrl.value) {
        URL.revokeObjectURL(imagePreviewUrl.value)
        imagePreviewUrl.value = null
    }
    if (pdfPreviewUrl.value) {
        URL.revokeObjectURL(pdfPreviewUrl.value)
        pdfPreviewUrl.value = null
    }
}

// Watch for dialog open/close
watch(showDialog, (newValue) => {
    if (newValue) {
        loadFilePreview()
    } else {
        cleanupUrls()
        textContent.value = ''
        previewError.value = ''
    }
})

// Cleanup on unmount
onUnmounted(() => {
    cleanupUrls()
})
</script>

<style lang="scss" scoped>
.file-preview-dialog-content {
    .file-preview-header {
        .file-info {
            flex: 1;

            .text-h6 {
                word-break: break-word;
                line-height: 1.2;
            }
        }
    }

    .file-preview-content {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        background: #fafafa;

        .image-preview {
            .image-container {
                text-align: center;

                .preview-image {
                    max-width: 100%;
                    max-height: 350px;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
            }
        }

        .text-preview {
            .text-container {
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 12px;
                max-height: 300px;
                overflow: auto;

                .text-content {
                    font-family: 'Courier New', monospace;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
            }
        }

        .pdf-preview {
            .pdf-container {
                .pdf-iframe {
                    width: 100%;
                    height: 350px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
            }
        }

        .preview-loading,
        .preview-error,
        .preview-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            text-align: center;
            min-height: 150px;
        }

        .preview-placeholder {
            background: #f5f5f5;
            border: 1px dashed #ccc;
            border-radius: 8px;
        }
    }

    .file-metadata {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 12px;

        .q-chip {
            margin: 2px;
        }
    }
}

@media (max-width: 600px) {
    .file-preview-dialog-content {
        .file-preview-content {
            .text-preview .text-container .text-content {
                font-size: 0.75rem;
            }

            .pdf-preview .pdf-container .pdf-iframe {
                height: 250px;
            }
        }
    }
}
</style>
