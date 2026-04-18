async function getNotionResume() {
  const pageId = Netlify.env.get('NOTION_PAGE_ID');
  const notionKey = Netlify.env.get('NOTION_API_KEY');

  const blocksRes = await fetch(
    `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    {
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Notion-Version': '2022-06-28'
      }
    }
  );

  const blocksData = await blocksRes.json();
  console.log('Blocks status:', blocksRes.status);

  if (!blocksData.results) {
    console.error('Notion error:', JSON.stringify(blocksData));
    return null;
  }

  const lines = blocksData.results.map(block => {
    const type = block.type;
    const content = block[type];
    if (!content) return '';
    if (content.rich_text && Array.isArray(content.rich_text)) {
      return content.rich_text.map(t => t.plain_text).join('');
    }
    return '';
  }).filter(Boolean);

  return lines.join('\n');
}

export default async function handler(req, context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const body = await req.json();
  const messages = body.messages;

  const resumeContext = await getNotionResume();

  if (!resumeContext) {
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Resume data could not be loaded. Please try again.' }]
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const systemPrompt = `You are a helpful AI assistant representing Avital Loeb, a job candidate. You are speaking to recruiters and hiring managers on Avi's behalf.

PRONOUNS: Avi uses they/them/theirs. Always use they/them — never she/her or he/him.

TONE AND STYLE RULES — follow these strictly:
- Always speak in THIRD PERSON. Say "Avi has experience in..." or "They've worked on..." never "I" or "my"
- Use natural, conversational EXPERIENCE language — not resume language. Say "Avi has spent time building..." not "Avi is proficient in..." or "per their resume..."
- Never reference "the resume" or "based on their background" as a phrase — just speak naturally about what they've done
- Keep responses light and readable. Put each distinct thought or achievement on its OWN LINE with a blank line between them
- Do not use bold text, headers, or bullet points — just clean short paragraphs separated by line breaks
- Be warm, specific, and highlight concrete numbers and achievements when relevant
- Actually answer the question being asked. If someone asks about data analysis, talk specifically about the kinds of analysis Avi has done, the tools they've used, and the decisions that work informed — not just metrics they hit
- If something isn't in their background, say so naturally: "That's not something Avi has focused on" rather than "that's not on the resume"

BACKGROUND DATA:
${resumeContext}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Netlify.env.get('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    })
  });

  const data = await response.json();
  console.log('Anthropic status:', response.status);
  if (data.error) console.error('Anthropic error:', JSON.stringify(data.error));

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
