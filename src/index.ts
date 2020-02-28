/// <reference types="node" />
import { FastifyReply } from 'fastify';
import { ServerResponse } from 'http';
import { Http2ServerResponse } from 'http2';

type HttpResponse = ServerResponse | Http2ServerResponse;

interface DateLike {
    oUTCString: typeof Date.prototype.toUTCString
}

export interface CacheDecorator {
    (
        this: FastifyReply<HttpResponse>,
        ttl: Date | number | DateLike,
        proxy?: number,
    ): FastifyReply<HttpResponse>;
}

declare module 'fastify' {
    interface FastifyReply<HttpResponse> {
        cache: CacheDecorator;
    }

}

/**
 * Generate appropriate “Cache-Control” and “Expires” headers
 *
 * IMPORTANT: if we receive a Date for ttl we must not include the “max-age”
 * portion of the Cache-Control header. This is simply because RFC2616 Section
 * 14.9.3 states that “If a response includes both an Expires header and a max-
 * age directive, the max-age directive overrides the Expires header, even if
 * the Expires header is more restrictive.” This is important when you intend to
 * have your response cache invalidated at a specific time (i.e. midnight).
 *
 * @param  {Date | number} ttl   - A Date object or number (milliseconds)
 * @param  {number}        [proxy] - number (milliseconds)
 * @return {{ Content-Type: string, Expires: string }}
 *
 */
export const cache = (ttl: Date | number | DateLike, proxy?: number) => {
    if (ttl instanceof Date) {
        // Expires @ specific time
        // Cache-Control: public
        return {
            'Cache-Control': 'public',
            'Expires': ttl.toUTCString()
        };
    }

    if (isPositiveFinite(ttl)) {
        const sMaxAge = isPositiveFinite(proxy) ? `, s-maxage=${msToSeconds(proxy)}` : '';
        return {
            'Cache-Control': `public, max-age=${msToSeconds(ttl)}${sMaxAge}`
        }
    }

    return {};
}

/**
 * Generate appropriate “Cache-Control” and “Expires” headers
 *
 * IMPORTANT: if we receive a Date for ttl we must not include the “max-age”
 * portion of the Cache-Control header. This is simply because RFC2616 Section
 * 14.9.3 states that “If a response includes both an Expires header and a max-
 * age directive, the max-age directive overrides the Expires header, even if
 * the Expires header is more restrictive.” This is important when you intend to
 * have your response cache invalidated at a specific time (i.e. midnight).
 *
 * @param  {Date | number} ttl   - A Date object or number (milliseconds)
 * @param  {number}        [proxy] - number (milliseconds)
 * @return {{ Content-Type: string, Expires: string }}
 *
 */
export const fastifyReplyDecorator: CacheDecorator = function (ttl: Date | number | DateLike, proxy?: number) {
    // Note: using an arrow function will break the binding of this to the Fastify
    // request instance.
    // https://github.com/fastify/fastify/blob/master/docs/Decorators.md
    const headers = cache(ttl, proxy);
    for (const [key, val] of Object.entries(headers)) {
        this.header(key, val);
    }
    return this;
};

const isPositiveFinite = (num: any): num is number => {
    if (typeof num === 'number' && Number.isFinite(num) && num > 0) {
        return true;
    }
    return false;
};

const msToSeconds = (num: number) => ~~(num / 1e3);

// hollow for now
export const purge = () => { };
// /**
//  * Purge specific URL(s) from the Nginx cache
//  *
//  * This method uses HTTP pipelining to support rapid deletion.
//  *
//  * @param   mixed   url         string or array of URL(s) to purge
//  *
//  * @return  mixed               boolean or array of booleans
//  */
//
// export const purge = (urls, prefix = '/purge') =>
//     Promise.all(chunk(Array.isArray(urls) ? urls : [urls], 64).map(urls =>
//
//         new Promise((resolve, reject) => {
//             const res = new Map();
//             let index = 0;
//
//             const socket = net.connect(80, 'mfs');
//             socket.setNoDelay(true);
//             socket
//                 .on('connect', () => {
//                     socket.write(urls
//                         .map(url => (String(url).match(/^(?:https?:)?(?:\/\/)?([^/]+)(?::\d+)?(.+)/) || []).slice(1, 3))
//                         .filter(a => a)
//                         .map(([domain, path], index, arr) => {
//                             const lines = [`PURGE ${prefix}${path} HTTP/1.1`, `Host: ${domain}`, 'User-Agent: RDPurge'];
//                             if (index === arr.length - 1) {
//                                 lines.push('Connection: close');
//                             }
//                             return lines.join('\r\n');
//                         })
//                         .join('\r\n\r\n') +
//                         '\r\n\r\n');
//                 })
//                 .on('data', data => {
//                     socket.end();
//                     data.toString()
//                         .split(/\n/)
//                         .filter(line => /^HTTP\/1.1 \d{3}/.test(line))
//                         .map(code => code.substr(9, 3) === '200')
//                         .forEach(status => res.set(urls[index++], status));
//                 })
//
//                 .on('end', () => resolve(res))
//
//                 .on('error', reject);
//
//         })))
//     .then(arrayOfMaps => arrayOfMaps.reduce((carry, map) => carry.concat(Array.from(map.entries())), []))
//     .then(masterArray => new Map(masterArray))
// // .then(foo => (console.debug(urls.length, foo.size, foo), foo))
// ;
//
// // purge([
// //     'http://win.bhg.com/',
// //     'http://win.bhg.com/recipes',
// //     'http://win.bhg.com/2018/01/01'
// // ]).then(res => console.log(res));
//
// const chunk = (arr, n) => Array.from(
//     Array(Math.ceil(arr.length / n)),
//     (_, i) => arr.slice(i * n, i * n + n)
// );
export default cache;