import { services } from "@forwardimpact/librpc";

const { EmbeddingBase } = services;

export class EmbeddingService extends EmbeddingBase {
  #backendUrl;

  constructor(config, backendUrl) {
    super(config);
    if (!backendUrl) throw new Error("backendUrl is required");
    this.#backendUrl = backendUrl;
  }

  async CreateEmbeddings(req) {
    const res = await fetch(`${this.#backendUrl}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: req.input, model: "default" }),
    });
    if (!res.ok) throw new Error(`TEI request failed: ${res.status}`);
    const body = await res.json();
    return { data: body.data.map((d) => ({ values: d.embedding })) };
  }
}
