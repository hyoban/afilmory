import { PhotoLibraryProvider } from '../library/photo-library'
import { PhotoLibraryDropUpload } from '../library/PhotoLibraryDropUpload'
import { PhotoLibraryGrid } from '../library/PhotoLibraryGrid'
import { PhotoPageScaffold } from '../PhotoPageScaffold'

export function PhotoLibraryTab() {
  return (
    <PhotoLibraryProvider isActive>
      <PhotoPageScaffold activeTab="library">
        <PhotoLibraryDropUpload />
        <PhotoLibraryGrid />
      </PhotoPageScaffold>
    </PhotoLibraryProvider>
  )
}
