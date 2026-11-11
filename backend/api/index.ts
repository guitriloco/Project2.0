export default async function handler(request: any, response: any) {
  try {
    const { default: appHandler } = await import('../src/app')
    return await appHandler(request, response)
  } catch (error) {
    console.error('[v0] Backend startup failure', error)
    response.statusCode = 503
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ error: 'Backend indisponível.' }))
  }
}
