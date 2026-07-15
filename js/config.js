const CONFIG = {
  API_BASE_URL: 'https://image.pollinations.ai/p/',
  DEFAULT_WIDTH: 1024,
  DEFAULT_HEIGHT: 1024,
  ENGINE_MAP: {
    'Phoenix — Photorealism': { model: 'flux', style: 'photorealistic, highly detailed, sharp focus, 8K' },
    'SDXL — Universal': { model: 'gptimage', style: '' },
    'DreamForge — Concept Art': { model: 'flux', style: 'concept art, fantasy art, intricate details, dramatic lighting, epic' },
    'Flux — Fast': { model: 'flux', style: '' },
    'AnimeXL — Anime Style': { model: 'flux', style: 'anime style, vibrant colors, cel shaded, Japanese animation style' },
    'WaifuStudio — Waifu Art': { model: 'flux', style: 'anime waifu style, cute character, detailed anime art' },
    'VelvetRender — Artistic': { model: 'flux', style: 'digital painting, velvet texture, artistic, smooth gradients, soft lighting' },
  },
  OPENROUTER_API_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_API_KEY: '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',
  CHAT_MODELS: {
    'Standard': 'openai/gpt-4o-mini',
    'Advanced': 'openai/gpt-4o',
    'Reasoning': 'deepseek/deepseek-r1',
    'Vision': 'openai/gpt-4o',
  },
  SITE_URL: window.location.origin,
  SITE_NAME: 'Epes',
};
