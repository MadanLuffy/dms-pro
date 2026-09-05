export function wrapLocalFiles(fileList) {
  return Array.from(fileList || []).map((file) => ({
    id: `local-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    file,
  }));
}

export function toUploadFiles(items) {
  return (items || [])
    .map((item) => (item instanceof File ? item : item?.file))
    .filter(Boolean);
}

export function removePendingFile(items, id) {
  return (items || []).filter((item, index) => {
    if (item?.id != null && id != null) return item.id !== id;
    if (typeof id === 'number') return index !== id;
    if (item instanceof File) {
      return `${item.name}-${item.size}-${item.lastModified}` !== id;
    }
    return item?.name !== id;
  });
}
