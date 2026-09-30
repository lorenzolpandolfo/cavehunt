const DEFAULT_SERVER_PORT = '2567';

export function serverEndpoint(address: string): string | undefined
{
    try
    {
        const hasProtocol = /^https?:\/\//i.test(address);
        const url = new URL(hasProtocol ? address : `http://${address}`);
        if (!url.hostname || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
            return undefined;
        if (!hasProtocol && !url.port) url.port = DEFAULT_SERVER_PORT;
        return url.origin;
    }
    catch
    {
        return undefined;
    }
}
