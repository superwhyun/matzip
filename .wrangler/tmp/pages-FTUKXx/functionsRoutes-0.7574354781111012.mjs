import { onRequestGet as __api_restaurants_js_onRequestGet } from "/Users/whyun/workspace/matzip/functions/api/restaurants.js"
import { onRequestOptions as __api_restaurants_js_onRequestOptions } from "/Users/whyun/workspace/matzip/functions/api/restaurants.js"
import { onRequestPost as __api_restaurants_js_onRequestPost } from "/Users/whyun/workspace/matzip/functions/api/restaurants.js"

export const routes = [
    {
      routePath: "/api/restaurants",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_restaurants_js_onRequestGet],
    },
  {
      routePath: "/api/restaurants",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_restaurants_js_onRequestOptions],
    },
  {
      routePath: "/api/restaurants",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_restaurants_js_onRequestPost],
    },
  ]