import type { InjectConfig } from '~/config/types'

type ReactionInjectConfig = InjectConfig & {
  useNext?: boolean
}

export const canUsePhotoReactions = (config: ReactionInjectConfig): boolean => {
  return config.useApi || config.useCloud
}
