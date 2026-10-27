const noop = async () => ({ data: {} })
const instance: any = noop
instance.get = noop; instance.post = noop; instance.put = noop; instance.delete = noop
instance.interceptors = { request: { use: () => 0 }, response: { use: () => 0 } }
instance.create = () => instance
export default instance
export const create = () => instance
