<script lang="ts" setup>
import { type TranslateFn, type Feature, type FeatureId } from '@/types/common';

const props = defineProps<{
  feature: Feature;
  t: TranslateFn;
}>();

const emit = defineEmits<{
  (e: 'open', id: FeatureId): void;
}>();
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
    <button
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
</style>
