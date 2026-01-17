<script lang="ts" setup>
import { type TranslateFn, type Feature, type FeatureId } from '@/types/common';

const props = defineProps<{
  feature: Feature;
  t: TranslateFn;
  toggleState?: boolean;
}>();

const emit = defineEmits<{
  (e: 'open', id: FeatureId): void;
  (e: 'toggle', id: FeatureId, enabled: boolean): void;
}>();

function handleToggle() {
  emit('toggle', props.feature.id, !props.toggleState);
}
</script>

<template>
  <article
    class="feature-card"
    :class="{ disabled: !feature.ready }"
  >
    <div class="feature-head">
      <h3>{{ t(feature.titleKey) }}</h3>
      <span class="badge" :class="feature.ready ? 'live' : 'soon'">
        {{ feature.ready ? t('feature_badge_live') : t('feature_badge_soon') }}
      </span>
    </div>
    <p class="feature-desc">{{ t(feature.descKey) }}</p>
    
    <!-- Toggle Mode -->
    <button
      v-if="feature.toggleMode && feature.ready"
      type="button"
      class="toggle-btn"
      :class="{ active: toggleState }"
      @click="handleToggle"
    >
      <span class="toggle-track">
        <span class="toggle-thumb"></span>
      </span>
      <span class="toggle-label">{{ toggleState ? t('common_on') : t('common_off') }}</span>
    </button>
    
    <!-- Open Button (default) -->
    <button
      v-else
      type="button"
      class="btn"
      :disabled="!feature.ready"
      @click="emit('open', feature.id)"
    >
      {{ feature.ready ? t('button_open_feature') : t('feature_coming_soon') }}
    </button>
  </article>
</template>

<style scoped>
.feature-card {
  border: 1px solid rgba(79, 70, 229, 0.08);
  border-radius: 12px;
  padding: 14px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.feature-card.disabled {
  opacity: 0.7;
}
.feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.feature-head h3 {
  margin: 0;
  font-size: 15px;
}
.feature-desc {
  margin: 0;
  color: #475569;
  font-size: 13px;
  min-height: 40px;
}
.badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}
.badge.live {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.badge.soon {
  background: rgba(236, 72, 153, 0.12);
  color: #be185d;
  border: 1px solid rgba(236, 72, 153, 0.2);
}

/* Toggle Switch Styles */
.toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  width: 100%;
}
.toggle-track {
  position: relative;
  width: 40px;
  height: 22px;
  background: #cbd5e1;
  border-radius: 11px;
  transition: background 0.2s ease;
}
.toggle-btn.active .toggle-track {
  background: #4f46e5;
}
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}
.toggle-btn.active .toggle-thumb {
  transform: translateX(18px);
}
.toggle-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.toggle-btn.active .toggle-label {
  color: #4f46e5;
}
</style>
