// Simple smoke test for translation endpoints and logic
async function runTest() {
  console.log('--- Testing Google Translate Public Client Endpoint ---');
  const text = 'Witaj świecie! To jest profesjonalna książka przygotowana do druku A5.';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pl&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  
  const res = await fetch(url);
  const data = await res.json();
  const translated = data[0].map(item => item[0]).join('');
  console.log('Result EN:', translated);

  console.log('--- Testing German translation ---');
  const urlDe = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pl&tl=de&dt=t&q=${encodeURIComponent(text)}`;
  const resDe = await fetch(urlDe);
  const dataDe = await resDe.json();
  const translatedDe = dataDe[0].map(item => item[0]).join('');
  console.log('Result DE:', translatedDe);

  console.log('--- Testing Spanish translation ---');
  const urlEs = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pl&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  const resEs = await fetch(urlEs);
  const dataEs = await resEs.json();
  const translatedEs = dataEs[0].map(item => item[0]).join('');
  console.log('Result ES:', translatedEs);

  console.log('✓ Smoke tests passed successfully!');
}

runTest().catch(console.error);
