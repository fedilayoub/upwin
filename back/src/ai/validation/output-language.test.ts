import { describe, expect, it } from 'vitest';
import {
  OUTPUT_LANGUAGES,
  type OutputLanguage,
} from '../../proposal-preferences/proposal-preferences.schema';
import {
  distinctiveWords,
  isInOtherLanguage,
  languageHits,
} from './output-language';

/**
 * Draft-like text in every output language: a full proposal paragraph, two
 * short screening answers, and a second paragraph written to lean on words
 * the languages share (`o`, `es`, `was`, `an`, `of`, `sua`). Technical terms
 * stay in English, as they do in real proposals.
 */
const SAMPLES: Record<OutputLanguage, { long: string[]; short: string[] }> = {
  en: {
    long: [
      'Hi, I read your brief for the React dashboard and I can start this week. I have built three analytics dashboards with Next.js and a Node API, and the last one cut report load time from 9 seconds to under 2. For your project I would start with the data model, then wire the charts to your Postgres views, and ship a first screen you can click through within five days. Could you share which metrics matter most to your team?',
      'Thanks for the clear post. I was a backend developer at a fintech for four years, so an audit log and role based access are things I have done many times. If it helps, I can also write the migration plan so your team is not blocked while we work on it.',
    ],
    short: [
      'Yes, I have shipped Stripe billing for two SaaS products, including webhooks and usage quotas.',
      'I usually start with a short call to confirm the scope, then send a written plan before any code.',
    ],
  },
  fr: {
    long: [
      "Bonjour, j'ai lu votre annonce pour le tableau de bord React et je peux commencer cette semaine. J'ai réalisé trois tableaux de bord analytiques avec Next.js et une API Node, et le dernier a réduit le temps de chargement des rapports de 9 secondes à moins de 2. Pour votre projet, je commencerais par le modèle de données, puis je relierais les graphiques à vos vues Postgres, et je vous livrerais un premier écran cliquable en cinq jours. Quels indicateurs comptent le plus pour votre équipe ?",
      "Merci pour cette annonce claire. J'ai été développeur backend dans une fintech pendant quatre ans, donc un journal d'audit et des accès par rôle, c'est quelque chose que j'ai fait souvent. Si cela vous aide, je peux aussi rédiger le plan de migration pour que votre équipe ne soit pas bloquée pendant que nous y travaillons.",
    ],
    short: [
      "Oui, j'ai mis en place la facturation Stripe pour deux produits SaaS, avec les webhooks et les quotas d'usage.",
      "Je commence en général par un court appel pour valider le périmètre, puis je vous envoie un plan écrit avant d'écrire du code.",
    ],
  },
  de: {
    long: [
      'Hallo, ich habe Ihre Ausschreibung für das React-Dashboard gelesen und kann diese Woche anfangen. Ich habe drei Analyse-Dashboards mit Next.js und einer Node-API gebaut, und beim letzten sank die Ladezeit der Berichte von 9 Sekunden auf unter 2. Für Ihr Projekt würde ich mit dem Datenmodell beginnen, dann die Diagramme an Ihre Postgres-Views anbinden und Ihnen innerhalb von fünf Tagen einen ersten klickbaren Bildschirm liefern. Welche Kennzahlen sind für Ihr Team am wichtigsten?',
      'Danke für die klare Beschreibung. Ich war vier Jahre Backend-Entwickler bei einem Fintech, daher sind ein Audit-Log und rollenbasierter Zugriff etwas, das ich oft gemacht habe. Wenn es hilft, kann ich auch den Migrationsplan schreiben, damit Ihr Team nicht blockiert ist, während wir daran arbeiten. Was ist Ihnen an dem Projekt am wichtigsten?',
    ],
    short: [
      'Ja, ich habe die Stripe-Abrechnung für zwei SaaS-Produkte umgesetzt, mit Webhooks und Nutzungskontingenten.',
      'Ich beginne meist mit einem kurzen Gespräch, um den Umfang zu klären, und schicke dann einen schriftlichen Plan, bevor ich Code schreibe.',
    ],
  },
  es: {
    long: [
      'Hola, leí su propuesta para el panel de React y puedo empezar esta semana. He creado tres paneles de análisis con Next.js y una API en Node, y el último redujo el tiempo de carga de los informes de 9 segundos a menos de 2. Para su proyecto empezaría por el modelo de datos, luego conectaría los gráficos a sus vistas de Postgres y le entregaría una primera pantalla navegable en cinco días. ¿Qué métricas son las más importantes para su equipo?',
      'Gracias por la descripción tan clara. Fui desarrollador backend en una fintech durante cuatro años, así que un registro de auditoría o el acceso por roles es algo que he hecho muchas veces. Si le sirve, también puedo escribir el plan de migración para que su equipo no se bloquee mientras trabajamos en ello, y es posible empezar el lunes.',
    ],
    short: [
      'Sí, he implementado la facturación con Stripe para dos productos SaaS, con webhooks y cuotas de uso.',
      'Normalmente empiezo con una llamada corta para confirmar el alcance y luego le envío un plan por escrito antes de escribir código.',
    ],
  },
  it: {
    long: [
      "Ciao, ho letto il suo annuncio per la dashboard in React e posso iniziare questa settimana. Ho realizzato tre dashboard di analisi con Next.js e una API in Node, e l'ultima ha ridotto il tempo di caricamento dei report da 9 secondi a meno di 2. Per il suo progetto partirei dal modello dei dati, poi collegherei i grafici alle sue viste Postgres e le consegnerei una prima schermata navigabile in cinque giorni. Quali metriche sono più importanti per il suo team?",
      "Grazie per la descrizione chiara. Sono stato sviluppatore backend in una fintech per quattro anni, quindi un registro di audit o l'accesso per ruoli è qualcosa che ho fatto spesso. Se le è utile, posso anche scrivere il piano di migrazione così la sua squadra non resta bloccata mentre ci lavoriamo, e il suo progetto può partire lunedì.",
    ],
    short: [
      'Sì, ho implementato la fatturazione con Stripe per due prodotti SaaS, con i webhook e le quote di utilizzo.',
      'Di solito inizio con una breve chiamata per confermare il perimetro e poi le invio un piano scritto prima di scrivere il codice.',
    ],
  },
  nl: {
    long: [
      'Hallo, ik heb uw opdracht voor het React-dashboard gelezen en ik kan deze week beginnen. Ik heb drie analysedashboards gebouwd met Next.js en een Node-API, en bij het laatste daalde de laadtijd van de rapporten van 9 seconden naar minder dan 2. Voor uw project zou ik beginnen met het datamodel, daarna de grafieken koppelen aan uw Postgres-views en u binnen vijf dagen een eerste klikbaar scherm leveren. Welke cijfers zijn het belangrijkst voor uw team?',
      'Bedankt voor de duidelijke omschrijving. Ik was vier jaar backend-ontwikkelaar bij een fintech, dus een auditlog of toegang op basis van rollen is iets wat ik vaak heb gedaan. Als het helpt, kan ik ook het migratieplan schrijven zodat uw team niet stilstaat terwijl we eraan werken. Is het goed als ik maandag begin, of heeft u liever een gesprek eerst?',
    ],
    short: [
      'Ja, ik heb Stripe-facturatie gebouwd voor twee SaaS-producten, met webhooks en gebruiksquota.',
      'Ik begin meestal met een kort gesprek om de scope te bevestigen en stuur daarna een geschreven plan voordat ik code schrijf.',
    ],
  },
  pt: {
    long: [
      'Olá, li a sua descrição para o painel em React e posso começar esta semana. Já criei três painéis de análise com Next.js e uma API em Node, e o último reduziu o tempo de carregamento dos relatórios de 9 segundos para menos de 2. Para o seu projeto eu começaria pelo modelo de dados, depois ligaria os gráficos às suas views do Postgres e entregaria uma primeira tela navegável em cinco dias. Quais métricas são mais importantes para a sua equipe?',
      'Obrigado pela descrição clara. Fui desenvolvedor backend numa fintech durante quatro anos, então um log de auditoria ou o acesso por perfis é algo que já fiz muitas vezes. Se ajudar, também posso escrever o plano de migração para que a sua equipe não fique bloqueada enquanto trabalhamos nisso, e o projeto pode começar na segunda.',
    ],
    short: [
      'Sim, já implementei a cobrança com Stripe em dois produtos SaaS, com webhooks e cotas de uso.',
      'Normalmente começo com uma chamada curta para confirmar o escopo e depois envio um plano escrito antes de qualquer código.',
    ],
  },
};

const OTHERS = (language: OutputLanguage) =>
  OUTPUT_LANGUAGES.filter((other) => other !== language);

describe('output language check', () => {
  it.each(OUTPUT_LANGUAGES)(
    'accepts every %s sample when that language is requested',
    (language) => {
      const { long, short } = SAMPLES[language];
      for (const text of [...long, ...short]) {
        expect(isInOtherLanguage(text, language), text).toBe(false);
      }
    },
  );

  it.each(OUTPUT_LANGUAGES)(
    'rejects a %s paragraph when any other language is requested',
    (language) => {
      for (const text of SAMPLES[language].long) {
        for (const requested of OTHERS(language)) {
          expect(isInOtherLanguage(text, requested), requested).toBe(true);
        }
      }
    },
  );

  it.each(OUTPUT_LANGUAGES)(
    'scores a %s paragraph well ahead of every other language',
    (language) => {
      for (const text of SAMPLES[language].long) {
        const hits = languageHits(text);
        const rival = Math.max(...OTHERS(language).map((other) => hits[other]));
        expect(hits[language] - rival).toBeGreaterThanOrEqual(5);
      }
    },
  );

  it('ignores words two languages share', () => {
    // `de`, `la`, `a` and `que` are listed for several languages.
    expect(languageHits('de la a que de la a que')).toEqual(
      Object.fromEntries(OUTPUT_LANGUAGES.map((language) => [language, 0])),
    );
  });

  it('passes a block with too few function words to judge', () => {
    expect(isInOtherLanguage('React, Node.js, AWS and Postgres.', 'es')).toBe(
      false,
    );
  });

  it.each(OUTPUT_LANGUAGES)(
    'gives %s enough distinctive words to detect it',
    (language) => {
      expect(distinctiveWords(language).length).toBeGreaterThanOrEqual(10);
    },
  );
});
