-- Allow regenerated HTML and figure images (drawn charts, uploads) in the past-papers bucket
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/html',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
]
where id = 'past-papers';