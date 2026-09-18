'use strict';
// Project 2 Phase 4.5 - disclaimer screen (inert, deterministic, used by the Draft Adapter).
// Owner delegation of 2026-09-19.
//
// GATE-SIM-001 showed that most sentences which block RIGHT answers assert nothing: they mention
// the question's own terms inside a statement of ignorance - "I cannot determine which commit
// merged pull request #248". A statement of ignorance has no evidence by nature, so every screen
// for unsupported specifics, reserved vocabulary or present-state claims fires on it.
// This screen decides, for one sentence, whether it is such a disclaimer. It is deliberately
// narrow, because every sentence it accepts stops being checked:
//   1. the sentence contains a marker of ignorance (not a bare negation: "cannot be denied" is none);
//   2. nothing risky and no clause connective stands BEFORE the marker, and the lead-in is short;
//   3. every risky token lies inside the marker's scope, which ends at the first clause boundary;
//   4. what follows the scope is empty, or a reason, or another statement of ignorance - and
//      carries nothing risky;
//   5. no contrast connective occurs anywhere ("I cannot confirm, but PR #254 was merged ...").
// "Risky" is exactly what the gate screens for: reserved terms, specific values, present-state words.
const claimLabels=require('../authority/claim-labels');
const sentinel=require('../sentinel/sentinel-v0');
const gatekeeper=require('../gatekeeper/gatekeeper-v0');

const VERSION='sinbad-disclaimer-screen/0-v1';
const MAX_LEAD_IN_WORDS=12;
const EDGE='(?<![\\p{L}\\p{N}])';const END='(?![\\p{L}\\p{N}])';
// Verbs of knowing, finding and telling: what one can fail to do about a fact without asserting it.
const KNOW='(?:determine|confirm|verify|provide|find|locate|answer|tell|say|give|quote|access|know|identify|establish)';
const IGNORANCE=new RegExp(`${EDGE}(?:(?:cannot|can't|can not|could not|couldn't|am unable to|are unable to|is unable to|unable to|am not able to|not able to) (?:\\w+ly )?${KNOW}|not possible to (?:\\w+ly )?${KNOW}|(?:do|does|did) not (?:\\w+ly )?(?:have access|relate|contain|mention|include|specify|state|indicate|provide|cover|address|say)|(?:is|are|was|were) not (?:\\w+ly )?(?:stated|mentioned|provided|available|specified|included|documented|known|given)|no (?:information|mention|record|reference|data|details?|indication) (?:is |are |was |were )?(?:available|provided|given|found|about|on|regarding)|(?:you|one) would need to (?:check|consult|access|verify|refer)|none of the (?:provided |given |available )?(?:excerpts|sources|documents|passages)|bilmiyorum|bilgim yok|erişimim yok|belirtilmemiş|belirtilmiyor|yer almıyor|yer almamaktadır|teyit edemem|doğrulayamam|söyleyemem|belirleyemem)${END}`,'iu');
const CONTRAST=new RegExp(`${EDGE}(?:but|however|yet|although|though|whereas|while|nevertheless|still|ancak|fakat|ama|oysa|lakin|yine de)${END}`,'iu');
const CONNECTIVE=new RegExp(`${EDGE}(?:and|or|so|then|ve|veya|sonra)${END}`,'iu');
const ADDITIVE=new RegExp(`${EDGE}(?:and|so|then|plus|also|ve|sonra|ayrıca)${END}`,'iu');
const BOUNDARY=/[,;:()]|\s[-–—]\s/u;
const REASON=new RegExp(`^\\s*(?:as|because|since|given that|given|based on|from|due to|in|within|according to|çünkü|zira)${END}`,'iu');
const global=re=>new RegExp(re.source,re.flags.includes('g')?re.flags:`${re.flags}g`);
const RESERVED=claimLabels.RESERVED_TERMS.map(term=>new RegExp(`(?<![\\p{L}\\p{N}_])${term.replace(/ /gu,'\\s+')}(?![\\p{L}\\p{N}_])`,'giu'));
const RISKY=Object.freeze([...RESERVED,global(sentinel.SPECIFIC_VALUE),global(gatekeeper.VOLATILE)]);

// riskySpans(text) -> [{start,end}] of everything the gate's text screens react to.
function riskySpans(text){
  const spans=[];
  for(const re of RISKY){re.lastIndex=0;for(let m=re.exec(text);m;m=re.exec(text)){spans.push({start:m.index,end:m.index+m[0].length});if(m[0].length===0)re.lastIndex+=1;}}
  return spans;
}
// Guidance: "To find X, you would need to ..." / "If you have access to Y, I recommend checking ...".
// The risky words sit in the purpose or condition clause; the main clause only tells the reader
// what to do and must itself carry nothing risky.
const GUIDANCE_OPENING=new RegExp(`^\\s*(?:to|in order to|if you|if one|for (?:the |a )?)${END}`,'iu');
const GUIDANCE_MAIN=new RegExp(`^\\s*(?:you (?:would need to|will need to|need to|can|could|should|may)|it would be necessary to|it is necessary to|i (?:would )?recommend|we recommend|please|consult|check|refer to)${END}`,'iu');
function isGuidance(text){
  if(!GUIDANCE_OPENING.test(text)||CONTRAST.test(text))return false;
  const comma=text.indexOf(',');if(comma<0)return false;
  const main=text.slice(comma+1);
  if(!GUIDANCE_MAIN.test(main)||riskySpans(main).length||/[;:]/u.test(main))return false;
  // "..., you can check git log and PR #254 was merged" - an additive connective may open an assertion.
  return !ADDITIVE.test(main);
}
// classify(text) -> {disclaimer:boolean, reason:string}. Pure; never throws on a string.
function classify(text){
  if(typeof text!=='string'||!text.length)return {disclaimer:false,reason:'NOT_TEXT'};
  if(isGuidance(text))return {disclaimer:true,reason:'GUIDANCE'};
  const marker=IGNORANCE.exec(text);
  if(!marker)return {disclaimer:false,reason:'NO_IGNORANCE_MARKER'};
  if(CONTRAST.test(text))return {disclaimer:false,reason:'CONTRAST_CONNECTIVE'};
  const markerStart=marker.index,markerEnd=marker.index+marker[0].length;
  const leadIn=text.slice(0,markerStart);
  // A leading connective phrase ("Therefore,") may carry one comma; anything else before the marker must be a plain subject.
  const leadBody=leadIn.replace(/^\s*[\p{L}' ]{0,40},\s*/u,'');
  if(BOUNDARY.test(leadBody)||CONNECTIVE.test(leadBody))return {disclaimer:false,reason:'CLAUSE_BEFORE_MARKER'};
  if((leadIn.match(/[\p{L}\p{N}]+/gu)||[]).length>MAX_LEAD_IN_WORDS)return {disclaimer:false,reason:'LEAD_IN_TOO_LONG'};
  const afterMarker=text.slice(markerEnd);const boundary=BOUNDARY.exec(afterMarker);
  const scopeEnd=boundary?markerEnd+boundary.index:text.length;
  const risky=riskySpans(text);
  if(risky.some(s=>s.start<markerStart))return {disclaimer:false,reason:'RISKY_BEFORE_MARKER'};
  if(risky.some(s=>s.start>=scopeEnd))return {disclaimer:false,reason:'RISKY_OUTSIDE_SCOPE'};
  // "and / so / then" inside the scope may open a second clause that asserts ("... the date and PR #254 was merged");
  // a disjunction stays under the ignorance ("cannot determine X or Y").
  if(ADDITIVE.test(text.slice(markerEnd,scopeEnd)))return {disclaimer:false,reason:'ADDITIVE_CONNECTIVE_IN_SCOPE'};
  const rest=boundary?text.slice(scopeEnd+boundary[0].length):'';
  if(/[\p{L}\p{N}]/u.test(rest)&&!REASON.test(rest)&&!IGNORANCE.test(rest))return {disclaimer:false,reason:'ASSERTION_AFTER_SCOPE'};
  return {disclaimer:true,reason:'IGNORANCE_DISCLAIMER'};
}
const isDisclaimer=text=>classify(text).disclaimer;
module.exports=Object.freeze({VERSION,MAX_LEAD_IN_WORDS,IGNORANCE,CONTRAST,riskySpans,classify,isDisclaimer});
