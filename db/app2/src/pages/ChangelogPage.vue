<template>
  <q-page class="changelog-page q-pa-md">
    <div class="row justify-center">
      <div class="col-12 col-md-10 col-lg-8">
        <!-- Header -->
        <div class="text-center q-mb-lg">
          <q-icon name="history" size="48px" color="primary" class="q-mb-md" />
          <div class="text-h4 text-weight-bold q-mb-sm">{{ $t('changelog.title') }}</div>
          <div class="text-subtitle1 text-grey-7">{{ $t('changelog.subtitle') }}</div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center q-pa-xl">
          <q-spinner color="primary" size="48px" />
          <div class="text-body1 text-grey-7 q-mt-md">{{ $t('changelog.loading') }}</div>
        </div>

        <!-- Error State -->
        <q-banner v-else-if="error" class="bg-negative text-white q-mb-md" rounded>
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          <div class="text-subtitle2 q-mb-sm">{{ $t('changelog.error') }}</div>
          <div>{{ error }}</div>
        </q-banner>

        <!-- Changelog Content -->
        <q-card v-else flat bordered class="changelog-card">
          <q-card-section>
            <div class="changelog-content" v-html="changelogHtml"></div>
          </q-card-section>
        </q-card>

        <!-- Back Button -->
        <div class="text-center q-mt-lg">
          <q-btn
            flat
            color="primary"
            :label="$t('common.back')"
            icon="arrow_back"
            @click="$router.back()"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const loading = ref(true)
const error = ref(null)
const changelogHtml = ref('')

/**
 * Simple markdown to HTML converter for changelog
 */
const markdownToHtml = (markdown) => {
  if (!markdown) return ''

  let html = markdown

  // Headers (order matters - most specific first)
  html = html.replace(/^#### (.*$)/gim, '<h4 class="changelog-h4">$1</h4>')
  html = html.replace(/^### (.*$)/gim, '<h3 class="changelog-h3">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 class="changelog-h2">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 class="changelog-h1">$1</h1>')

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Lists - handle both - and * list markers
  html = html.replace(/^[-*] (.*$)/gim, '<li class="changelog-li">$1</li>')

  // Wrap consecutive list items in ul
  html = html.replace(/(<li class="changelog-li">.*<\/li>\n?)+/gim, (match) => {
    return '<ul class="changelog-ul">' + match + '</ul>'
  })

  // Code blocks (simple inline)
  html = html.replace(/`([^`]+)`/gim, '<code class="changelog-code">$1</code>')

  // Date patterns like [2025-01-XX] - make them stand out
  html = html.replace(/\[(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-XX)\]/gim, '<span class="changelog-date">[$1]</span>')

  // Line breaks - convert double newlines to paragraph breaks, but preserve structure
  // Split by double newlines and wrap in paragraphs, but skip if it's a header or list
  const lines = html.split('\n\n')
  html = lines
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      // Don't wrap headers, lists, or already wrapped content
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('</')) {
        return trimmed
      }
      return `<p class="changelog-p">${trimmed}</p>`
    })
    .filter((line) => line)
    .join('\n')

  // Clean up empty paragraphs
  html = html.replace(/<p class="changelog-p"><\/p>/gim, '')
  html = html.replace(/<p class="changelog-p">(<[^>]+>)/gim, '$1')
  html = html.replace(/(<\/[^>]+>)<\/p>/gim, '$1')

  return html
}

/**
 * Load changelog file
 */
const loadChangelog = async () => {
  loading.value = true
  error.value = null

  try {
    // Try to fetch from public folder first, then fallback to root
    let response = await fetch('/CHANGELOG.md')
    
    if (!response.ok) {
      // Try alternative path
      response = await fetch('./CHANGELOG.md')
    }
    
    if (!response.ok) {
      throw new Error(`Failed to load changelog: ${response.status} ${response.statusText}`)
    }

    const markdown = await response.text()
    changelogHtml.value = markdownToHtml(markdown)
  } catch (err) {
    console.error('Error loading changelog:', err)
    error.value = err.message || 'Failed to load changelog'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadChangelog()
})
</script>

<style lang="scss" scoped>
.changelog-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.changelog-card {
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.changelog-content {
  :deep(.changelog-h1) {
    font-size: 2rem;
    font-weight: bold;
    margin: 2rem 0 1rem 0;
    color: #1976d2;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 0.5rem;
  }

  :deep(.changelog-h2) {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 1.5rem 0 1rem 0;
    color: #424242;
  }

  :deep(.changelog-h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: #616161;
  }

  :deep(.changelog-h4) {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: #757575;
  }

  :deep(.changelog-p) {
    margin: 0.75rem 0;
    line-height: 1.6;
    color: #424242;
  }

  :deep(.changelog-ul) {
    margin: 0.75rem 0;
    padding-left: 2rem;
    list-style-type: disc;
  }

  :deep(.changelog-li) {
    margin: 0.5rem 0;
    line-height: 1.6;
    color: #424242;
  }

  :deep(.changelog-code) {
    background: #f5f5f5;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: #d32f2f;
  }

  :deep(a) {
    color: #1976d2;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;

    &:hover {
      border-bottom-color: #1976d2;
    }
  }

  :deep(strong) {
    font-weight: 600;
    color: #212121;
  }

  :deep(.changelog-date) {
    color: #1976d2;
    font-weight: 500;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
}
</style>

