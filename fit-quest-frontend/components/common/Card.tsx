import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
};

export function Card({ children, onPress, className = '' }: CardProps) {
  const baseClass = `rounded-lg bg-white p-4 shadow ${className}`.trim();

  if (onPress) {
    return (
      <Pressable className={baseClass} onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  return <View className={baseClass}>{children}</View>;
}
