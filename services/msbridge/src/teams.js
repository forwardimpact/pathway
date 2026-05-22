import botbuilder from "botbuilder";

const { CloudAdapter, ConfigurationBotFrameworkAuthentication, TurnContext } =
  botbuilder;

export { CloudAdapter, ConfigurationBotFrameworkAuthentication, TurnContext };

export const TYPING_VERBS = [
  "Moonwalking",
  "Unravelling",
  "Tempering",
  "Crafting",
  "Simmering",
  "Percolating",
  "Decoding",
];

function pickVerb() {
  return TYPING_VERBS[Math.floor(Math.random() * TYPING_VERBS.length)];
}

/**
 * Reaction adapter for the Bot Framework. Sends a `messageReaction` activity
 * with `reactionsAdded: [{ type: "like" }]` on start and the matching
 * `reactionsRemoved` on finish — Microsoft's Bot SDK does not surface a
 * generic emoji reaction type, so `like` is the closest immediate
 * acknowledgement we can offer.
 *
 * @param {object} adapter - Bot Framework CloudAdapter (or compatible stub)
 * @param {() => string} msAppIdFn
 * @returns {{add: Function, remove: Function}}
 */
export function buildReactionAdapter(adapter, msAppIdFn) {
  return {
    add: async (target) => {
      if (!target?.ref || !target?.activityId) return null;
      await adapter.continueConversationAsync(
        msAppIdFn(),
        target.ref,
        async (turnContext) => {
          await turnContext.sendActivity({
            type: "messageReaction",
            replyToId: target.activityId,
            reactionsAdded: [{ type: "like" }],
          });
        },
      );
      return "like";
    },
    remove: async (_reactionId, target) => {
      if (!target?.ref || !target?.activityId) return;
      await adapter.continueConversationAsync(
        msAppIdFn(),
        target.ref,
        async (turnContext) => {
          await turnContext.sendActivity({
            type: "messageReaction",
            replyToId: target.activityId,
            reactionsRemoved: [{ type: "like" }],
          });
        },
      );
    },
  };
}

/**
 * Ticker adapter that posts a random "Moonwalking…" verb as a fresh
 * message activity. Teams is a more immediate medium than GitHub
 * Discussions; the verbs give a sense of presence while the workflow
 * dispatch is running.
 *
 * @param {object} adapter
 * @param {() => string} msAppIdFn
 * @returns {{tick: Function}}
 */
export function buildTickerAdapter(adapter, msAppIdFn) {
  return {
    tick: async (target, _n) => {
      if (!target?.ref) return;
      const verb = pickVerb();
      await adapter.continueConversationAsync(
        msAppIdFn(),
        target.ref,
        async (turnContext) => {
          await turnContext.sendActivity(`${verb}...`);
        },
      );
    },
  };
}

/**
 * Post `text` as a Teams message in the conversation identified by `ref`.
 * @param {object} adapter
 * @param {() => string} msAppIdFn
 * @param {object} ref
 * @param {string} text
 */
export async function sendReply(adapter, msAppIdFn, ref, text) {
  await adapter.continueConversationAsync(
    msAppIdFn(),
    ref,
    async (turnContext) => {
      await turnContext.sendActivity(text);
    },
  );
}

/**
 * Build the default Bot Framework CloudAdapter wired to the service config.
 * @param {object} config
 * @returns {object}
 */
export function createDefaultAdapter(config) {
  const auth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: config.msAppId(),
    MicrosoftAppPassword: config.msAppPassword(),
    MicrosoftAppTenantId: config.msAppTenantId(),
    MicrosoftAppType: "SingleTenant",
  });
  return new CloudAdapter(auth);
}
