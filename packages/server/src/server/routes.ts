import { logging } from "@palmares/core";

import Server from ".";
import { FunctionControllerType } from "../controllers/types";
import Middleware from "../middlewares";
import { BaseRoutesType } from "../routers/types";
import { PathParamsType } from "../types";
import { LOGGING_REQUEST } from "../utils";
import {
  CannotParsePathParameterException,
  NotImplementedServerException
} from "./exceptions";
import {
  PathParamsTypes,
  PathParams,
  RawParamsType,
  PathParamsParser
} from "./types";

/**
 * This class is responsible for translating the routes to something that the lib can understand.
 * Those routes will be loaded in the server.
 */
export default class ServerRoutes {
  server: Server;

  constructor(server: Server) {
    this.server = server;
  }

  /**
   * This is used to retrieve the parameters of the path if it has any.
   *
   * By default we do not use `:parameter` as custom path parameters we are using `<label: type_or_regex>`.
   * Most frameworks use `:parameter` as custom path parameters so we need to translate from
   * `<label: type_or_regex>` to `:label`.
   *
   * We do not translate this by default, you need to create your own custom translator for the framework
   * that you are using.
   *
   * @param path - The path to be translated.
   *
   * @returns - A promise that resolves to an array of path parameters.
   */
  async #getPathParameters(path: string): Promise<PathParams[]> {
    const valueRegex = /^<\w+:/;
    const regexPath = /<(\w+)\s*:\s*(.+)>/g;
    const nonRegexPath = /<(\w+)(\s*:\s*(string|number))?>/g;

    const isNonRegexPath = nonRegexPath.test(path);
    const isRegexPath = regexPath.test(path);
    if (isNonRegexPath) {
      const allMatches = path.match(nonRegexPath) || [];
      return allMatches.map(match => {
        const withoutTypeRegex = /^<\w+>$/;
        const isMatchWithoutType = withoutTypeRegex.test(match);
        if (isMatchWithoutType) {
          return {
            value: match,
            paramName: match.replace(/(<|>)/g, ''),
            paramType: 'string'
          };
        }

        const valueOfMatch = match.match(valueRegex);
        if (valueOfMatch) {
          const paramName = valueOfMatch[0].replace(/(\s|:|^<)/g, '');
          const paramType = match.replace(valueOfMatch[0], '').replace(/\s|>$/g, '');
          const isOfTypeStringOrNumber = paramType === 'string' || paramType === 'number';
          if (isOfTypeStringOrNumber) {
            return {
              value: match,
              paramName,
              paramType: paramType as "string" | "number"
            }
          }
        }
        throw new CannotParsePathParameterException(path, match);
      });
    }
    if (isRegexPath) {
      const allMatches = path.match(regexPath) || [];
      return allMatches.map(match => {
        const valueOfMatch = match.match(valueRegex);
        if (valueOfMatch) {
          const paramName = valueOfMatch[0].replace(/(\s|:|^<)/g, '');
          const paramType = new RegExp(match.replace(valueOfMatch[0], '').replace(/\s|>$/g, ''));
          return {
            value: match,
            paramName,
            paramType
          }
        }
        throw new CannotParsePathParameterException(path, match);
      });
    }
    return [];
  }

  /**
   * This will return the paths translated to the framework that you are using. Normally the we define how parameters
   * should be defined inside of the framework. For example, if you are using Express, you can define the parameters
   * like this:
   * ```
   * app.get('/:id', (req, res) => {
   *  const id = req.params.id;
   *  res.send(id);
   * });
   * ```
   *
   * On palmares on the other hand, we would define the parameters like this:
   * ```
   * path('/<id: number>', (request) => {
   *  const id = request.params.id;
   *  return id;
   * })
   * ```
   *
   * @param path - The path to be translated and formatted to something that the framework is able to understand.
   *
   * @returns - A promise that resolves to the path translated to the framework that is being used.
   */
  async getPathHandlerAndMiddlewares<R = undefined>(
    path: string,
    handler: FunctionControllerType,
    middlewares: typeof Middleware[]
  ){
    let formattedPath = path;
    const pathParameters = await this.#getPathParameters(path);
    const pathParamsParser = await this.#getPathParamsParser(pathParameters);
    const promises = pathParameters.map(async (pathParameter) => {
      const translatedParameter = await this.translatePathParameter(
        pathParameter.paramName,
        pathParameter.paramType
      );
      formattedPath = formattedPath.replace(pathParameter.value, translatedParameter);
    });
    await Promise.all(promises);

    // This returns the loaded data from the
    const loadedMiddlewareData = await this.#getLoadedMiddlewares(middlewares);

    const formattedHandler = await this.#getHandlerForPath(handler, pathParamsParser, middlewares);
    return {
      path: formattedPath,
      handler: formattedHandler,
      middlewares: loadedMiddlewareData
    };
  }

  /**
   * This will return the path params formatter for a given path. This path params parser will
   * parse the path parameters to a certain value. For example if we define the path param as `<id: number>`
   * then we will convert `id` to a number, so when you make `request.params.id` you will get the value
   * as a number instead of a string.
   *
   * @param pathParams - The path parameters of the path. This is an array with all of the path parameters
   * so we can convert them accordingly on each request.
   *
   * @returns - A promise that resolves to the path params parser function that receives the path parameters
   * and parses them.
   */
  async #getPathParamsParser(pathParams: PathParams[]): Promise<PathParamsParser> {
    return (rawParams: RawParamsType) => {
      const params: PathParamsType = {};
      for (const pathParam of pathParams) {
        const paramValue = rawParams[pathParam.paramName];
        const isStringParamType = pathParam.paramType === 'string';
        const isNumberParamType = pathParam.paramType === 'number';
        const isRegexParamType = pathParam.paramType instanceof RegExp;
        if (paramValue) {
          if (isStringParamType) {
            params[pathParam.paramName] = paramValue;
          } else if (isNumberParamType) {
            params[pathParam.paramName] = parseInt(paramValue);
          } else if (isRegexParamType && (pathParam.paramType as RegExp).test(paramValue)) {
            params[pathParam.paramName] = paramValue;
          }
        }
      }
      return params;
    };
  }

  /**
   * This will return all of the middlewares that are defined for the path loaded. `load` is a method
   * that enables us to still use middlewares from the framework that we are using instead of using
   * the palmares middleware system.
   *
   * For example, if you want to use Express's `cors` middleware, you would need to use it like this:
   * ```
   * class ExpressCorsMiddleware extends Middleware {
   *   static async load(_: ExpressServer): Promise<ExpressMiddlewareHandlerType> {
   *     return cors();
   *   }
   * }
   * ```
   *
   * And later in your routes you would register it like this:
   * ```
   * path('/', ExpressCorsMiddleware, {
   *    GET: {
   *     handler: (request) => {}
   *   }
   * })
   * ```
   *
   * @param middlewares - The middlewares that are defined for this specific path.
   *
   * @returns - A promise that resolves to the data returned from the `load()` method of the middleware.
   */
  async #getLoadedMiddlewares(middlewares: typeof Middleware[]) {
    return (await Promise.all(middlewares.map(async middleware =>
      (await middleware.load<undefined>(this.server))
    ))).filter(data => data !== undefined);
  }

  /**
   * This is responsible to attach the middlewares to the handler in a linked list fashion, this way
   * we are able to use the middlewares in a same api fashion as Django. The core idea of this function
   * is to transform an array of middlewares into a linked list like fashion.
   *
   * For that we append one middleware to the other and then return the root middleware to be called.
   * You need to make sure that you bind the functions, this way we do not lose the reference by `this`
   * inside of the functions.
   *
   * @param handler - The handler that is going to be called after the middlewares are attached.
   * @param middlewares - The middlewares that are going to be attached to the handler.
   *
   * @returns - A promise that resolves to the root middleware that is going to be called or the
   * handler if there are no middlewares.
   */
  async #getHandlerWithMiddlewaresAttached(
    handler: FunctionControllerType,
    middlewares: typeof Middleware[]
  ): Promise<FunctionControllerType> {
    let requestHandler = handler;
    const previousMiddleware = middlewares[0];
    if (previousMiddleware) {
      let initializedPreviousMiddleware = new previousMiddleware();
      requestHandler = initializedPreviousMiddleware.run.bind(initializedPreviousMiddleware);

      for (let i = 1; i < middlewares.length; i++) {
        const nextMiddleware = middlewares[i];
        const initializedNextMiddleware = new nextMiddleware();
        await initializedPreviousMiddleware.init(initializedNextMiddleware.run.bind(initializedNextMiddleware));
        initializedPreviousMiddleware = initializedNextMiddleware;
      }
      await initializedPreviousMiddleware.init(handler.bind(handler));
    }
    return requestHandler
  }

  /**
   * This is responsible for formatting the handler to be used in the framework that is being used.
   * By doing this we can append all logic here instead of inside of the framework, this makes it easier
   * to build custom servers. On here we can handle stuff like logging, middleware, exception handling and so on.
   *
   * This is the function that will be called no matter the framework that is being used to handle the request.
   * Could be Express, Koa or any other framework.
   *
   * @param handler - The handler that is going to be called after the middlewares are attached.
   * @param pathParamsParser - The path params parser that is going to be used to parse the path parameters.
   * @param middlewares - The middlewares that are going to be attached to the handler.
   */
  async #getHandlerForPath(
    handler: FunctionControllerType,
    pathParamsParser: PathParamsParser,
    middlewares: typeof Middleware[]
  ) {
    return async (req: any) => {
      const elapsedStartTime = performance.now();

      const request = await this.server.requests.translate(req);
      await request._appendPathParamsParser(pathParamsParser);

      const requestHandler = await this.#getHandlerWithMiddlewaresAttached(handler, middlewares);
      const response = await Promise.resolve(requestHandler(request));

      const elapsedEndTime = performance.now();
      const elapsedTime = elapsedEndTime - elapsedStartTime;
      logging.logMessage(LOGGING_REQUEST, { method: request.method, path: request.path, elapsedTime: elapsedTime });
      return 'TESTE';
    }
  }

  /**
   * This is obligatory if you're adding a new framework. This is responsible for translating the routes to something
   * like `<label: number>` or `<label: string>` or `<label: regex>` to something that the framework itself is
   * able to understand. Those parameters on the express framework would be something like this `:label` or `:label(\d+)`.
   *
   * @param name - The name of the label. On `<id: number>` this would be `id`.
   * @param type - The type of the variable. On `<id: number>` this would be `number`.
   *
   * @returns - A string that is going to be used to translate the route to the framework.
   */
  async translatePathParameter(name: string, type: PathParamsTypes): Promise<string> {
    throw new NotImplementedServerException('translatePathParameter');
  }

  async initialize(routes: BaseRoutesType[]): Promise<void> {
    throw new NotImplementedServerException('initialize');
  }
}