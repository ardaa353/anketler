/** Ultimate 3D Survey bridge — Google Apps Script backend.
 * Deploy as a web app, executing as the form owner/editor.
 * IMPORTANT: the deploying Google account must have edit access to each target Form.
 */
const SLOT_COUNT = 10;
const SLOT_INDEX_KEY = 'ULTIMATE3D_SLOT_INDEX';
const SLOT_PREFIX = 'ULTIMATE3D_SLOT_';
const TOKEN_PREFIX = 'ULTIMATE3D_TOKEN_';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Ultimate 3D Anket')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function createSurveyLink(formUrl) {
  const form = openTargetForm_(formUrl);
  if (!form.isAcceptingResponses()) throw new Error('Bu Google Form şu anda yanıt kabul etmiyor.');
  // Confirm the account running this script can read the form and its questions.
  const questions = getQuestions_(form);
  if (!questions.length) throw new Error('Formda desteklenen soru bulunamadı.');

  const props = PropertiesService.getScriptProperties();
  const previousIndex = Number(props.getProperty(SLOT_INDEX_KEY) || '-1');
  const slot = (previousIndex + 1) % SLOT_COUNT;
  const oldToken = props.getProperty(SLOT_PREFIX + slot);
  if (oldToken) props.deleteProperty(TOKEN_PREFIX + oldToken);

  const token = Utilities.getUuid().replace(/-/g, '');
  props.setProperty(TOKEN_PREFIX + token, JSON.stringify({ formId: form.getId(), formUrl: form.getPublishedUrl(), slot: slot, createdAt: new Date().toISOString() }));
  props.setProperty(SLOT_PREFIX + slot, token);
  props.setProperty(SLOT_INDEX_KEY, String(slot));
  return {
    url: ScriptApp.getService().getUrl() + '?token=' + encodeURIComponent(token),
    message: 'Bağlantı oluşturuldu. En fazla 10 bağlantı etkin tutulur; yeni bağlantı 10 yuvayı sırayla devreder.'
  };
}

function loadSurvey(token) {
  const entry = getToken_(token);
  const form = openFormById_(entry.formId);
  if (!form.isAcceptingResponses()) return { closed: true, formUrl: entry.formUrl, questions: [] };
  return { closed: false, formUrl: form.getPublishedUrl(), questions: getQuestions_(form) };
}

function submitSurvey(token, answers, respondentEmail) {
  const entry = getToken_(token);
  const form = openFormById_(entry.formId);
  if (!form.isAcceptingResponses()) throw new Error('Anket kapatılmış; Google Forms artık yanıt kabul etmiyor.');
  const response = form.createResponse();
  const questions = getQuestions_(form);
  const missing = [];
  questions.forEach(q => {
    const raw = answers && Object.prototype.hasOwnProperty.call(answers, String(q.id)) ? answers[String(q.id)] : undefined;
    const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);
    if (q.required && empty) missing.push(q.title);
    if (empty) return;
    const item = form.getItemById(Number(q.id));
    if (!item) return;
    let itemResponse;
    switch (q.type) {
      case 'text': itemResponse = item.asTextItem().createResponse(String(raw)); break;
      case 'paragraph': itemResponse = item.asParagraphTextItem().createResponse(String(raw)); break;
      case 'radio': itemResponse = item.asMultipleChoiceItem().createResponse(String(raw)); break;
      case 'select': itemResponse = item.asListItem().createResponse(String(raw)); break;
      case 'checkbox': itemResponse = item.asCheckboxItem().createResponse(Array.isArray(raw) ? raw.map(String) : [String(raw)]); break;
      case 'scale': itemResponse = item.asScaleItem().createResponse(Number(raw)); break;
      case 'date': {
        const parts = String(raw).split('-').map(Number);
        itemResponse = item.asDateItem().createResponse(new Date(parts[0], parts[1] - 1, parts[2])); break;
      }
      case 'time': {
        const parts = String(raw).split(':').map(Number);
        itemResponse = item.asTimeItem().createResponse(parts[0], parts[1]); break;
      }
      default: break;
    }
    if (itemResponse) response.withItemResponse(itemResponse);
  });
  if (missing.length) throw new Error('Zorunlu soruları yanıtla: ' + missing.join(', '));
  response.submit();
  return { ok: true, message: 'Yanıtınız Google Forms tarafından kaydedildi.' };
}

function getToken_(token) {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) throw new Error('Bağlantı geçersiz veya artık etkin değil.');
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(TOKEN_PREFIX + token);
  if (!raw) throw new Error('Bu bağlantı geçersiz kılınmış veya bulunamıyor. Yeni bağlantı oluşturulmasını isteyin.');
  const entry = JSON.parse(raw);
  if (props.getProperty(SLOT_PREFIX + entry.slot) !== token) throw new Error('Bu bağlantı artık etkin değil.');
  return entry;
}

function openTargetForm_(url) {
  if (!url || !/^https:\/\/docs\.google\.com\/forms\//i.test(url)) throw new Error('Geçerli bir Google Forms bağlantısı gir.');
  try { return FormApp.openByUrl(url); }
  catch (e) { throw new Error('Form okunamadı. Apps Script’i çalıştıran Google hesabının forma düzenleyici erişimi olduğundan emin ol. Mümkünse formun /edit bağlantısını kullan. Ayrıntı: ' + e.message); }
}
function openFormById_(id) {
  try { return FormApp.openById(id); }
  catch (e) { throw new Error('Google Form artık erişilemiyor veya silinmiş.'); }
}

function getQuestions_(form) {
  return form.getItems().map(item => {
    const typeName = String(item.getType());
    const base = { id: String(item.getId()), title: item.getTitle() || 'Soru', text: item.getHelpText() || '', required: false, type: null, options: [] };
    try { base.required = item.asTextItem().isRequired(); } catch (_) {}
    try { base.required = item.asParagraphTextItem().isRequired(); } catch (_) {}
    try { base.required = item.asMultipleChoiceItem().isRequired(); } catch (_) {}
    try { base.required = item.asListItem().isRequired(); } catch (_) {}
    try { base.required = item.asCheckboxItem().isRequired(); } catch (_) {}
    try { base.required = item.asScaleItem().isRequired(); } catch (_) {}
    try { base.required = item.asDateItem().isRequired(); } catch (_) {}
    try { base.required = item.asTimeItem().isRequired(); } catch (_) {}
    if (typeName === 'TEXT') base.type = 'text';
    else if (typeName === 'PARAGRAPH_TEXT') base.type = 'paragraph';
    else if (typeName === 'MULTIPLE_CHOICE') { base.type = 'radio'; base.options = item.asMultipleChoiceItem().getChoices().map(c => c.getValue()); }
    else if (typeName === 'LIST') { base.type = 'select'; base.options = item.asListItem().getChoices().map(c => c.getValue()); }
    else if (typeName === 'CHECKBOX') { base.type = 'checkbox'; base.options = item.asCheckboxItem().getChoices().map(c => c.getValue()); }
    else if (typeName === 'SCALE') { const x=item.asScaleItem(); base.type='scale'; base.lower=x.getLowerBound(); base.upper=x.getUpperBound(); }
    else if (typeName === 'DATE') base.type = 'date';
    else if (typeName === 'TIME') base.type = 'time';
    else return null; // Unsupported question types are not silently rendered as if supported.
    return base;
  }).filter(Boolean);
}
