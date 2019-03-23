const stringify = args => {
  let out = ''

  for (let i = 0; i < args.length; i++) {
    out += `${args[i]},`
  }

  return out
}

export default fn => {
  let args, value

  return function () {
    const argString =  stringify(arguments)

    if (argString === args) {
      return value
    }

    args = argString
    value = fn.apply(this, arguments)
    return value
  }
}