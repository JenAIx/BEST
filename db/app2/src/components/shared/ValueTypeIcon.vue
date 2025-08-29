<template>
    <q-avatar :color="getValueTypeColor(valueType)" :text-color="getValueTypeTextColor()" :size="size"
        :class="avatarClass">
        <q-icon :name="getValueTypeIcon(valueType)" :size="iconSize" />
        <q-tooltip v-if="showTooltip" class="bg-grey-9">
            {{ getValueTypeLabel(valueType) }} - {{ getValueTypeDescription(valueType) }}
        </q-tooltip>
    </q-avatar>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    valueType: {
        type: String,
        required: true
    },
    size: {
        type: String,
        default: '32px'
    },
    showTooltip: {
        type: Boolean,
        default: true
    },
    variant: {
        type: String,
        default: 'default', // 'default', 'chip', 'minimal'
        validator: (value) => ['default', 'chip', 'minimal'].includes(value)
    }
})

const iconSize = computed(() => {
    const sizeMap = {
        '24px': '14px',
        '28px': '16px',
        '32px': '18px',
        '40px': '22px',
        '48px': '26px'
    }
    return sizeMap[props.size] || '16px'
})

const avatarClass = computed(() => {
    const classes = []
    if (props.variant === 'chip') {
        classes.push('q-chip-style')
    } else if (props.variant === 'minimal') {
        classes.push('minimal-style')
    }
    return classes.join(' ')
})

const getValueTypeIcon = (valueType) => {
    const icons = {
        'A': 'quiz',           // Answer/Alphanumeric - question mark for answers
        'D': 'event',          // Date - calendar icon
        'F': 'search',         // Finding - magnifying glass for findings
        'N': 'tag',            // Numeric - tag/number icon
        'Q': 'quiz',           // Questionnaire - same as questionnaires in main menu
        'R': 'description',    // Raw Text - document icon
        'S': 'list',           // Selection - list icon for selections
        'T': 'text_fields'     // Text - text fields icon
    }
    return icons[valueType] || 'help'
}

const getValueTypeColor = (valueType) => {
    const colors = {
        'A': 'blue',      // Answer/Alphanumeric
        'D': 'orange',    // Date
        'F': 'green',     // Finding
        'N': 'teal',      // Numeric
        'Q': 'deep-purple', // Questionnaire - distinctive color
        'R': 'purple',    // Raw Text
        'S': 'indigo',    // Selection
        'T': 'brown'      // Text
    }
    return colors[valueType] || 'grey'
}

const getValueTypeTextColor = () => {
    // Most colors look good with white text
    return 'white'
}

const getValueTypeLabel = (valueType) => {
    const labels = {
        'A': 'Answer',
        'D': 'Date',
        'F': 'Finding',
        'N': 'Numeric',
        'Q': 'Questionnaire',
        'R': 'Raw Text',
        'S': 'Selection',
        'T': 'Text'
    }
    return labels[valueType] || valueType
}

const getValueTypeDescription = (valueType) => {
    const descriptions = {
        'A': 'Alphanumeric answer values',
        'D': 'Date and time values',
        'F': 'Clinical findings and observations',
        'N': 'Numeric measurements',
        'Q': 'Questionnaire responses and forms',
        'R': 'Raw unstructured text',
        'S': 'Coded selection values',
        'T': 'Structured text values'
    }
    return descriptions[valueType] || 'Unknown value type'
}
</script>

<style lang="scss" scoped>
.q-chip-style {
    border-radius: 16px;
}

.minimal-style {
    box-shadow: none;
    border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
