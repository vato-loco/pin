// Vangt alles onder /api/. De logica staat in _pinapi.js; bestanden die met een
// liggend streepje beginnen worden door Pages niet als route aangeboden, dus
// _pinapi.js en _offers.js zijn zelf niet op te vragen.
import { afhandelen } from './_pinapi.js';

export const onRequest = (context) => afhandelen(context.request, context.env);
