/**
 * Painel da Casa — ponte com o Google Agenda.
 * Cole este código em https://script.google.com (Novo projeto), ajuste CALENDARIOS
 * e publique como "App da Web" (Executar como: Eu; Quem pode acessar: Qualquer pessoa).
 * O painel só LÊ os eventos; nada é alterado na sua agenda.
 */
var CALENDARIOS = [
  { id: 'primary',                       nome: 'Ele',   cor: '#4fc3f7' }, // sua agenda principal
  { id: 'EMAIL_DA_ESPOSA@gmail.com',     nome: 'Ela',   cor: '#f48fb1' }, // agenda que ela compartilhou com você
  // { id: 'xxxxx@group.calendar.google.com', nome: 'Casa', cor: '#66d19e' } // agenda "Família", se criarem uma
];
// Uma palavra secreta simples para que só o seu painel leia a agenda (opcional).
var CHAVE = '';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (CHAVE && p.k !== CHAVE) return json({ error: 'chave inválida' });
  var dias = Math.min(+(p.days || 30), 90);
  var ini = new Date(); ini.setHours(0, 0, 0, 0);
  var fim = new Date(ini.getTime() + dias * 864e5);
  var out = [];
  CALENDARIOS.forEach(function (c) {
    var cal = c.id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(c.id);
    if (!cal) return;
    cal.getEvents(ini, fim).forEach(function (ev) {
      var allDay = ev.isAllDayEvent();
      out.push({
        title: ev.getTitle(),
        start: allDay ? Utilities.formatDate(ev.getAllDayStartDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd') : ev.getStartTime().toISOString(),
        end: allDay ? null : ev.getEndTime().toISOString(),
        allDay: allDay,
        calendar: c.nome,
        color: c.cor
      });
    });
  });
  return json({ events: out, generated: new Date().toISOString() });
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
