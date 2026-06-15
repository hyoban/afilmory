import { useAtomValue } from 'jotai'

import { gallerySettingAtom } from '~/atoms/app'

export const useHasActiveFilters = () => {
  const gallerySetting = useAtomValue(gallerySettingAtom)

  return (
    gallerySetting.selectedTags.length > 0
    || gallerySetting.selectedCameras.length > 0
    || gallerySetting.selectedLenses.length > 0
    || gallerySetting.selectedRatings !== null
    || gallerySetting.selectedDateRange !== null
  )
}
