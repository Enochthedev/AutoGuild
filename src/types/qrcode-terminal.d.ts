declare module 'qrcode-terminal' {
    export function generate(text: string, options?: { small: boolean }, cb?: (qrcode: string) => void): void;
    export function setError(cb: (error: any) => void): void;
}
