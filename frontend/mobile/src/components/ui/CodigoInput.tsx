import { Input, type InputProps } from "./Input";

type Props = Omit<InputProps, "keyboardType" | "maxLength" | "onChangeText"> & {
  onChangeText: (codigo: string) => void;
};

/**
 * Código de 6 dígitos del correo. Un solo campo (no seis cajas): se pega de una vez, el
 * sistema lo autocompleta (iOS lo ofrece desde el correo con oneTimeCode) y el lector lo lee
 * como un número. Solo deja dígitos.
 */
export function CodigoInput({ onChangeText, ...props }: Props) {
  return (
    <Input
      keyboardType="number-pad"
      maxLength={6}
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      importantForAutofill="yes"
      onChangeText={(texto) => onChangeText(texto.replace(/\D/g, "").slice(0, 6))}
      style={{ letterSpacing: 8, fontSize: 22 }}
      {...props}
    />
  );
}
