import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { extractDocumentText } from './parse-document.ts'

const ALT_CHUNK_DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="htmlChunk" />
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`

const ALT_CHUNK_MHT = `MIME-Version: 1.0
Content-Type: multipart/related;
    type="text/html";
    boundary="----=mhtDocumentPart"


------=mhtDocumentPart
Content-Type: text/html;
    charset="utf-8"
Content-Transfer-Encoding: quoted-printable
Content-Location: file:///C:/fake/document.html

<!DOCTYPE html><html><body><h1>极简接入教程</h1><p>测试链接：https://example.com/a=3Db</p></body></html>
------=mhtDocumentPart--
`

async function buildAltChunkDocxFile() {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="mht" ContentType="message/rfc822"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.mht"/>
</Relationships>`,
  )
  zip.file('word/document.xml', ALT_CHUNK_DOCUMENT_XML)
  zip.file('word/afchunk.mht', ALT_CHUNK_MHT)
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  return new File([buf], 'altchunk-fixture.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

test('extractDocumentText reads txt and md', async () => {
  const txt = new File(['你好，配音文稿。'], 'note.txt', { type: 'text/plain' })
  assert.equal(await extractDocumentText(txt), '你好，配音文稿。')

  const md = new File(['# 标题\n\n正文'], 'readme.md', { type: 'text/markdown' })
  assert.match(await extractDocumentText(md), /标题/)
})

test('extractDocumentText rejects legacy .doc', async () => {
  const doc = new File(['binary'], 'legacy.doc', { type: 'application/msword' })
  await assert.rejects(() => extractDocumentText(doc), /暂不支持旧版 \.doc/)
})

test('extractDocumentText rejects empty txt', async () => {
  const empty = new File(['   '], 'empty.txt', { type: 'text/plain' })
  await assert.rejects(() => extractDocumentText(empty), /文档内容为空/)
})

test('extractDocumentText reads Word compatibility mode altChunk MHT', async () => {
  const file = await buildAltChunkDocxFile()
  const text = await extractDocumentText(file)
  assert.match(text, /极简接入教程/)
  assert.match(text, /https:\/\/example\.com\/a=b/)
})
