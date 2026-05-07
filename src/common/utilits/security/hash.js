import { hashSync, compareSync } from "bcrypt";
import { saltrounds } from "../../../../conflig/conflig.service.js";
export function hash({ plain_text, saltround = saltrounds } = {}) {
    return hashSync(plain_text, Number(saltround))
}
export function compare({ plain_text, cipher_text } = {}) {
    return compareSync(plain_text, cipher_text)
}