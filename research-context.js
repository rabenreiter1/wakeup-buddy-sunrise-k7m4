import {loadProduct,persistProduct} from './repository.js';

export const locationLabel=location=>location?.city|| (Number.isFinite(location?.latitude)&&Number.isFinite(location?.longitude)?`Standort ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`:'');
export async function saveResearchPreferences({city,location,stocks}){
 const data=await loadProduct(),before=structuredClone(data.profile);
 if(city!==undefined)data.profile.location=city.trim()?{city:city.trim().slice(0,100)}:null;
 if(location!==undefined)data.profile.location=location;
 if(stocks!==undefined)data.profile.stocks=stocks.trim().slice(0,120);
 try{await persistProduct();}catch(error){data.profile=before;throw error;}
}
export function requestLocation(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Standort ist hier nicht verfügbar. Bitte gib deinen Ort ein.'));return;}
  navigator.geolocation.getCurrentPosition(position=>resolve({latitude:Math.round(position.coords.latitude*100)/100,longitude:Math.round(position.coords.longitude*100)/100}),()=>reject(new Error('Standort konnte nicht abgerufen werden. Bitte gib deinen Ort ein.')),{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
 });
}
export async function researchRequest(query){
 const {profile}=await loadProduct(),place=locationLabel(profile.location);
 if(query.includes('{{ort}}')&&!place){const error=new Error('Lege einen Ort für Wetter und lokale Inhalte fest.');error.code='location_required';throw error;}
 return query.replaceAll('{{ort}}',place).replaceAll('{{aktien}}',profile.stocks||'DAX, S&P 500 und wichtige internationale Unternehmensnachrichten');
}
export const locationForm=()=>`<form class="research-location-form" data-interactive><label class="label" for="research-city">Dein Ort</label><input id="research-city" class="field-input" name="city" maxlength="100" autocomplete="address-level2" placeholder="Stadt, Land" required><button type="submit" class="story-pill">Ort speichern</button><button type="button" class="story-pill" data-story="locate">Aktuellen Standort verwenden</button><p class="small">Einmalige Freigabe. Gespeichert wird nur dein ungefährer Standort.</p><p class="location-status" role="status"></p></form>`;
